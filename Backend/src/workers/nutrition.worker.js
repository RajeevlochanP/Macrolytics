import '../config/env.js';

import { Worker } from 'bullmq';
import { ChatOllama } from '@langchain/ollama';
import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { extractedNutritionSchema } from '../models/schemas.js';
import db from '../config/db.js';
import redisClient from '../config/redis.js';

export const startWorker = () => {
  const model = new ChatOllama({
    model: 'llama3.2-vision',
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(extractedNutritionSchema);

  const ExtractorState = Annotation.Root({
    imageUrl: Annotation({ reducer: (x, y) => y || x, default: () => "" }),
    extraction: Annotation({ reducer: (x, y) => y || x, default: () => null }),
    reflectionCount: Annotation({ reducer: (x, y) => x + (y || 0), default: () => 0 }),
    error: Annotation({ reducer: (x, y) => y || x, default: () => null }),
    isValid: Annotation({ reducer: (x, y) => y !== undefined ? y : x, default: () => false })
  });

  const extractorNode = async (state) => {
    try {
      const { imageUrl } = state;
      const prompt = `Extract nutritional information from the following image URL: ${imageUrl}. If you cannot determine the information, return an empty structure, but do not guess.`;
      
      const response = await structuredModel.invoke(prompt);
      return { extraction: response, error: null };
    } catch (e) {
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

  const worker = new Worker('nutrition-extraction', async job => {
    const { userId, s3Key, mealType } = job.data;
    
    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    let finalState;
    try {
      finalState = await app.invoke({ imageUrl });
    } catch (err) {
      throw new Error(`Extraction failed: ${err.message}`);
    }

    if (!finalState.isValid) {
      await redisClient.hSet(`job:${job.id}`, {
        state: 'FAILED',
        failedReason: "Failed to analyze the image clearly. Please ensure the food is well-lit and clearly visible."
      });
      return { status: 'failed_gracefully' };
    }

    const { extraction } = finalState;
    
    const query = `
      INSERT INTO food_entries (user_id, meal_type, item_name, quantity, quantity_unit, calories, protein, carbs, fat, micros, logged_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
    
    const values = [
      userId,
      mealType,
      extraction.item_name || 'Extracted Meal',
      extraction.quantity || 1,
      extraction.quantity_unit || 'serving',
      extraction.calories || 0,
      extraction.protein || 0,
      extraction.carbs || 0,
      extraction.fat || 0,
      extraction.micros ? JSON.stringify(extraction.micros) : null
    ];

    const res = await db.query(query, values);
    const entry = res.rows[0];

    const dateStr = new Date().toISOString().split('T')[0];
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    await redisClient.hIncrByFloat(redisKey, 'calories', entry.calories);
    await redisClient.hIncrByFloat(redisKey, 'protein', entry.protein);
    await redisClient.hIncrByFloat(redisKey, 'carbs', entry.carbs);
    await redisClient.hIncrByFloat(redisKey, 'fat', entry.fat);
    
    return entry;
  }, { connection: redisClient });

  worker.on('completed', (job) => console.log(`Job ${job.id} completed successfully`));
  worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err));

  return worker;
};

// Start immediately if executed directly
startWorker();
