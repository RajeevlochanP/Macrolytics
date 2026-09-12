import { Worker } from 'bullmq';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { extractedNutritionSchema } from '../models/schemas.js';
import db from '../config/db.js';
import redisClient from '../config/redis.js';

export const startWorker = () => {
  const model = new ChatGoogleGenerativeAI({
    modelName: 'gemini-1.5-pro',
    temperature: 0,
  });

  const worker = new Worker('nutrition-extraction', async (job) => {
    const { userId, s3Key, mealType } = job.data;
    
    // In a real scenario, you'd fetch the image/PDF from S3 using the s3Key.
    // For this demonstration, we'll assume the S3 URL is accessible or we pass the presigned GET url.
    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Prompt Gemini with Structured Output
    const structuredModel = model.withStructuredOutput(extractedNutritionSchema);
    
    // Here we use LangChain to invoke the vision model
    // Note: To pass images to Gemini, you generally convert it to base64 or pass the URL if supported.
    const response = await structuredModel.invoke([
      {
        type: 'text',
        text: 'Analyze the food in this image and extract nutritional information.'
      },
      {
        type: 'image_url',
        image_url: imageUrl
      }
    ]);

    // Save to PostgreSQL using Knex
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
      entryData.user_id,
      entryData.meal_type,
      entryData.item_name,
      entryData.quantity,
      entryData.quantity_unit,
      entryData.calories,
      entryData.protein,
      entryData.carbs,
      entryData.fat,
      entryData.image_url
    ];

    const result = await db.query(query, values);
    const entry = result.rows[0];

    // Update Redis Cache directly here or rely on a centralized service method
    const dateStr = new Date().toISOString().split('T')[0];
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    await redisClient.hIncrByFloat(redisKey, 'calories', entry.calories);
    await redisClient.hIncrByFloat(redisKey, 'protein', entry.protein);
    await redisClient.hIncrByFloat(redisKey, 'carbs', entry.carbs);
    await redisClient.hIncrByFloat(redisKey, 'fat', entry.fat);
    
    return entry;
  }, { connection: redisClient });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
  });

  return worker;
};
