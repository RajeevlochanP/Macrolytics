import { z } from 'zod';

export const mealTypeEnum = z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);

export const foodEntrySchema = z.object({
  user_id: z.string().uuid(),
  meal_type: mealTypeEnum,
  item_name: z.string(),
  quantity: z.number().positive(),
  quantity_unit: z.string(),
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  micros: z.record(z.any()).optional(),
  image_url: z.string().url().optional()
});

export const healthGoalSchema = z.object({
  user_id: z.string().uuid(),
  daily_calorie_target: z.number().int().positive(),
  protein_grams: z.number().int().nonnegative(),
  carb_grams: z.number().int().nonnegative(),
  fat_grams: z.number().int().nonnegative(),
  weight_goal: z.number().positive().optional()
});

// Used by Vision LLM for structured output
export const extractedNutritionSchema = z.object({
  item_name: z.string().describe("The name of the food item recognized"),
  quantity: z.number().describe("Quantity recognized"),
  quantity_unit: z.string().describe("Unit of quantity (e.g., grams, cups, serving)"),
  calories: z.number().int().describe("Estimated total calories"),
  protein: z.number().describe("Estimated protein in grams"),
  carbs: z.number().describe("Estimated carbs in grams"),
  fat: z.number().describe("Estimated fat in grams"),
  micros: z.record(z.string()).optional().describe("Micronutrients extracted, e.g. {\"vitamin_c\": \"10mg\", \"iron\": \"2mg\"}")
});
