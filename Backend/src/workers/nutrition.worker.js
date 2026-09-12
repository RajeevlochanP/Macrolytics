import fs from 'fs';
import path from 'path';
import os from 'os';
import '../config/env.js';

import { Worker } from 'bullmq';
import { ChatOllama } from '@langchain/ollama';
import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { extractedNutritionSchema } from '../models/schemas.js';
import db from '../config/db.js';
import redisClient from '../config/redis.js';
import s3Client from '../config/s3.js';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import IORedis from 'ioredis';
import { getLocalYMD } from '../utils/date.js';

export const startWorker = () => {
  const model = new ChatOllama({
    model: 'llava',
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(extractedNutritionSchema);

  const ExtractorState = Annotation.Root({
    base64Image: Annotation({ reducer: (x, y) => y || x, default: () => "" }),
    extraction: Annotation({ reducer: (x, y) => y || x, default: () => null }),
    reflectionCount: Annotation({ reducer: (x, y) => x + (y || 0), default: () => 0 }),
    error: Annotation({ reducer: (x, y) => y || x, default: () => null }),
    isValid: Annotation({ reducer: (x, y) => y !== undefined ? y : x, default: () => false })
  });

  const extractorNode = async (state) => {
    try {
      const { base64Image } = state;
      const response = await structuredModel.invoke([
        new HumanMessage({
          content: [
            { type: "text", text: "Extract nutritional information from this image. If you cannot determine the information, return an empty structure, but do not guess." },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        })
      ]);
      return { extraction: response, error: null };
    } catch (e) {
      console.error("[ExtractorNode] Error invoking Ollama:", e);
      return { error: e.message };
    }
  };

  const criticNode = async (state) => {
    const { extraction } = state;
    if (!extraction || Object.keys(extraction).length === 0) {
      return { isValid: false, reflectionCount: 1 };
    }

    const isValid = extraction.calories >= 0 && extraction.protein >= 0 && extraction.carbs >= 0 && extraction.fat >= 0;
    return { isValid, reflectionCount: 1 };
  };

  const shouldReflect = (state) => {
    if (state.isValid) {
      return END;
    }
    if (state.reflectionCount > 2) {
      return END;
    }
    return "extractor";
  };

  const workflow = new StateGraph(ExtractorState)
    .addNode("extractor", extractorNode)
    .addNode("critic", criticNode)
    .addEdge(START, "extractor")
    .addEdge("extractor", "critic")
    .addConditionalEdges("critic", shouldReflect);

  let app;
  try {
    app = workflow.compile();
  } catch (err) {
    console.error("Failed to compile LangGraph workflow in worker:", err);
    throw err;
  }

  const bullConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null
  });

  const worker = new Worker('nutrition-extraction', async job => {
    let localFilePath;
    try {
      console.log(`\n[Job ${job.id}] --- STARTING PROCESSING ---`);
      const { userId, s3Key, mealType } = job.data;

      localFilePath = path.join(os.tmpdir(), `${job.id}.jpg`);

      console.log(`[Job ${job.id}] 1. Fetching image from S3: ${s3Key}`);
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key
      }));

      const fileBuffer = Buffer.from(await s3Response.Body.transformToByteArray());
      fs.writeFileSync(localFilePath, fileBuffer);
      console.log(`[Job ${job.id}] 2. Image saved locally to ${localFilePath}`);

      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key
      }));
      console.log(`[Job ${job.id}] 3. Image deleted from S3`);

      const base64Data = fs.readFileSync(localFilePath).toString('base64');
      const base64Image = `data:image/jpeg;base64,${base64Data}`;
      console.log(`[Job ${job.id}] 4. Converted to base64 (Length: ${base64Data.length})`);

      let finalState;
      try {
        console.log(`[Job ${job.id}] 5. Invoking LangGraph / Ollama pipeline...`);
        finalState = await app.invoke({ base64Image });
        console.log(`[Job ${job.id}] 6. LangGraph execution finished. isValid: ${finalState.isValid}`);
      } catch (err) {
        throw new Error(`Extraction failed during LLM invocation: ${err.message}`);
      }

      if (!finalState.isValid) {
        console.log(`[Job ${job.id}] 7a. Validation failed, updating DB and Redis to FAILED state.`);
        await redisClient.hSet(`job:${job.id}`, {
          state: 'FAILED',
          failedReason: "Failed to analyze the image clearly. Please ensure the food is well-lit and clearly visible."
        });
        await db.query(`UPDATE food_entries SET status = 'FAILED' WHERE job_id = $1`, [job.id]);
        return { status: 'failed_gracefully' };
      }

      const { extraction } = finalState;
      console.log(`[Job ${job.id}] 7b. Validation passed. Updating DB with: ${extraction.item_name} (${extraction.calories} kcal)`);

      const query = `
        UPDATE food_entries 
        SET 
          item_name = $1,
          quantity = $2,
          quantity_unit = $3,
          calories = $4,
          protein = $5,
          carbs = $6,
          fat = $7,
          micros = $8,
          status = 'COMPLETED'
        WHERE job_id = $9
        RETURNING *
      `;

      const values = [
        extraction.item_name || 'Extracted Meal',
        extraction.quantity || 1,
        extraction.quantity_unit || 'serving',
        extraction.calories || 0,
        extraction.protein || 0,
        extraction.carbs || 0,
        extraction.fat || 0,
        extraction.micros ? JSON.stringify(extraction.micros) : null,
        job.id
      ];

      const res = await db.query(query, values);
      const entry = res.rows[0];

      console.log(`[Job ${job.id}] 8. Fetching timezone for Redis update...`);
      const jobData = await redisClient.hGetAll(`job:${job.id}`);
      const timeZone = jobData.timeZone || 'UTC';
      const dateStr = getLocalYMD(new Date(), timeZone);

      console.log(`[Job ${job.id}] 9. Updating daily totals in Redis for date: ${dateStr}`);
      const redisKey = `nutrition:daily:${userId}:${dateStr}`;
      await redisClient.hIncrByFloat(redisKey, 'calories', entry.calories);
      await redisClient.hIncrByFloat(redisKey, 'protein', entry.protein);
      await redisClient.hIncrByFloat(redisKey, 'carbs', entry.carbs);
      await redisClient.hIncrByFloat(redisKey, 'fat', entry.fat);

      console.log(`[Job ${job.id}] --- PROCESSING COMPLETE ---`);
      return entry;
    } catch (error) {
      console.error(`\n[Job ${job.id}] CRITICAL ERROR CAUGHT IN WORKER:`, error);
      await redisClient.hSet(`job:${job.id}`, {
        state: 'FAILED',
        failedReason: error.message
      });
      await db.query(`UPDATE food_entries SET status = 'FAILED' WHERE job_id = $1`, [job.id]);
      throw error;
    } finally {
      try {
        if (localFilePath && fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log(`[Job ${job.id}] Cleanup: Deleted local temp file.`);
        }
      } catch (delErr) {
        console.error(`[Job ${job.id}] Cleanup Error: Failed to delete local temp file.`, delErr);
      }
    }
  }, { connection: bullConnection });

  worker.on('failed', (job, err) => console.error(`Job ${job.id} officially failed in BullMQ:`, err));

  return worker;
};

// Start immediately if executed directly
startWorker();