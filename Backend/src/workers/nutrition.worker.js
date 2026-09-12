import { Worker } from 'bullmq';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, END, START } from '@langchain/langgraph';
import { extractedNutritionSchema } from '../models/schemas.js';
import db from '../config/db.js';
import redisClient from '../config/redis.js';

export const startWorker = () => {
  const model = new ChatOllama({
    model: 'llama3.1',
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(extractedNutritionSchema);

  const ExtractorState = {
    imageUrl: { value: (x, y) => y || x, default: () => "" },
    extraction: { value: (x, y) => y || x, default: () => null },
    reflectionCount: { value: (x, y) => x + (y || 0), default: () => 0 },
    error: { value: (x, y) => y || x, default: () => null },
    isValid: { value: (x, y) => y !== undefined ? y : x, default: () => false }
  };

  const extractorNode = async (state) => {
    try {
      const response = await structuredModel.invoke([
        { type: 'text', text: 'Analyze the food in this image and extract nutritional information.' },
        { type: 'image_url', image_url: state.imageUrl }
      ]);
      return { extraction: response };
    } catch (e) {
      return { extraction: null };
    }
  };

  const criticNode = async (state) => {
    const criticModel = new ChatOllama({ model: 'llama3.1', temperature: 0 });
    const response = await criticModel.invoke(`Is this extraction valid and complete? ${JSON.stringify(state.extraction)}. Reply YES or NO.`);
    const isValid = response.content.includes("YES");
    return { isValid, reflectionCount: 1 };
  };

  const routeAfterCritic = (state) => {
    if (state.isValid) return END;
    if (state.reflectionCount > 1) return "error_node";
    return "extractor";
  };
  
  const errorNode = (state) => {
    return { error: "Extraction failed validation after multiple attempts." };
  };

  const workflow = new StateGraph(ExtractorState)
    .addNode("extractor", extractorNode)
    .addNode("critic", criticNode)
    .addNode("error_node", errorNode)
    .addEdge(START, "extractor")
    .addEdge("extractor", "critic")
    .addConditionalEdges("critic", routeAfterCritic)
    .addEdge("error_node", END);

  const app = workflow.compile();

  const worker = new Worker('nutrition-extraction', async (job) => {
    const { userId, s3Key, mealType } = job.data;
    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    const result = await app.invoke({ imageUrl, reflectionCount: 0 });
    
    if (result.error || !result.extraction) {
      throw new Error(result.error || "Extraction failed");
    }

    const response = result.extraction;
    
    const entryData = {
      user_id: userId,
      meal_type: mealType,
      item_name: response.item_name,
      quantity: response.quantity,
      quantity_unit: response.quantity_unit,
      calories: response.calories,
      protein: response.protein,
      carbs: response.carbs,
      fat: response.fat,
      image_url: imageUrl
    };

    const query = `
      INSERT INTO food_entries 
        (user_id, meal_type, item_name, quantity, quantity_unit, calories, protein, carbs, fat, image_url)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      entryData.user_id, entryData.meal_type, entryData.item_name, entryData.quantity,
      entryData.quantity_unit, entryData.calories, entryData.protein, entryData.carbs,
      entryData.fat, entryData.image_url
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
