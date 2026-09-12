import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mealTypeEnum } from '../models/schemas.js';
import pool from '../config/db.js';
import { getLocalYMD } from '../utils/date.js';

export const createTools = (nutritionService, authService) => {
  const logMealTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        const timeZone = config?.configurable?.timeZone || 'UTC';

        console.log("Executing log_meal tool payload:", { userId, timeZone, input });
        console.log('Logging meal with payload:', { item_name: input.item_name, calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat });

        const query = `
          INSERT INTO food_entries (user_id, item_name, quantity, quantity_unit, calories, protein, carbs, fat, meal_type, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'COMPLETED')
          RETURNING *
        `;
        
        const values = [
          userId,
          input.item_name,
          input.quantity,
          input.quantity_unit,
          input.calories,
          input.protein,
          input.carbs,
          input.fat,
          input.mealType
        ];

        console.log("DB Query payload:", values);
        
        const result = await pool.query(query, values);
        const entry = result.rows[0];

        // Update Redis Cache
        const dateStr = getLocalYMD(new Date(), timeZone);
        const redisKey = `nutrition:daily:${userId}:${dateStr}`;

        await nutritionService.redisClient.hIncrByFloat(redisKey, 'calories', entry.calories || 0);
        await nutritionService.redisClient.hIncrByFloat(redisKey, 'protein', entry.protein || 0);
        await nutritionService.redisClient.hIncrByFloat(redisKey, 'carbs', entry.carbs || 0);
        await nutritionService.redisClient.hIncrByFloat(redisKey, 'fat', entry.fat || 0);
        await nutritionService.redisClient.expire(redisKey, 60 * 60 * 24 * 30, 'NX');

        return `Successfully logged ${input.quantity} ${input.quantity_unit} of ${input.item_name}.`;
      } catch (e) {
        console.error("log_meal tool failed:", e);
        return `Error logging meal. Please check your parameters. ${e.message}`;
      }
    },
    {
      name: 'log_meal',
      description: 'Log a food entry or meal for a user. You must infer the mealType based on user input or time of day.',
      schema: z.object({
        item_name: z.string(),
        quantity: z.number().positive(),
        quantity_unit: z.string(),
        calories: z.number().nonnegative().describe("You MUST estimate the total calories based on the food item and quantity using standard nutritional data. DO NOT pass 0."),
        protein: z.number().nonnegative().describe("You MUST estimate the total protein in grams. DO NOT pass 0 unless the food actually has no protein."),
        carbs: z.number().nonnegative().describe("You MUST estimate the total carbohydrates in grams. DO NOT pass 0 unless the food has no carbs."),
        fat: z.number().nonnegative().describe("You MUST estimate the total fat in grams. DO NOT pass 0 unless the food has no fat."),
        mealType: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks'])
      })
    }
  );

  const queryNutritionTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        const summary = await nutritionService.getDailySummary(userId, input.date);
        return JSON.stringify(summary);
      } catch (e) {
        return `Error querying nutrition: ${e.message}`;
      }
    },
    {
      name: 'query_nutrition',
      description: 'Query aggregated daily nutrition for a given date (YYYY-MM-DD).',
      schema: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  );

  const checkGoalsTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        const result = await nutritionService.checkGoals(userId, input.date);
        return JSON.stringify(result);
      } catch (e) {
        return `Error checking goals: ${e.message}`;
      }
    },
    {
      name: 'check_goals',
      description: 'Check a user\'s daily nutrition progress against their health goals for a specific date (YYYY-MM-DD).',
      schema: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  );

  const savePermanentPreferenceTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        await authService.updateUserPreferences(userId, input.key, input.value);
        return `Successfully saved preference '${input.key}' as '${JSON.stringify(input.value)}'.`;
      } catch (e) {
        return `Error saving preference: ${e.message}`;
      }
    },
    {
      name: 'save_permanent_preference',
      description: 'Saves a permanent dietary restriction, preference, allergy, or long-term goal for the user to their permanent profile.',
      schema: z.object({
        key: z.string(),
        value: z.any()
      })
    }
  );

  const setHealthGoalsTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        await nutritionService.setHealthGoals(userId, {
          daily_calorie_target: input.daily_calorie_target,
          protein_grams: input.protein_grams,
          carb_grams: input.carb_grams,
          fat_grams: input.fat_grams,
          weight_goal: input.weight_goal
        });
        return `Successfully set health goals for user.`;
      } catch (e) {
        return `Error setting health goals: ${e.message}`;
      }
    },
    {
      name: 'set_health_goals',
      description: 'Set or update the user\'s daily health goals (macros, calories, weight).',
      schema: z.object({
        daily_calorie_target: z.number().int().positive(),
        protein_grams: z.number().int().nonnegative(),
        carb_grams: z.number().int().nonnegative(),
        fat_grams: z.number().int().nonnegative(),
        weight_goal: z.number().positive().optional()
      })
    }
  );

  const listRecentMealsTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        const entries = await nutritionService.getFoodEntries(userId, input.limit || 10);
        return JSON.stringify(entries);
      } catch (e) {
        return `Error listing recent meals: ${e.message}`;
      }
    },
    {
      name: 'list_recent_meals',
      description: 'Retrieve a list of the user\'s recently logged food entries and meals.',
      schema: z.object({
        limit: z.number().int().positive().optional()
      })
    }
  );

  const getWeeklySummaryTool = tool(
    async (input, config) => {
      try {
        const userId = config?.configurable?.userId;
        const report = await nutritionService.getWeeklyReport(userId, input.endDate);
        return JSON.stringify(report);
      } catch (e) {
        return `Error getting weekly summary: ${e.message}`;
      }
    },
    {
      name: 'get_weekly_summary',
      description: 'Retrieve a daily aggregation of calories and macros for the past 7 days ending on the specified date.',
      schema: z.object({
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  );

  return [
    logMealTool, 
    queryNutritionTool, 
    checkGoalsTool, 
    savePermanentPreferenceTool,
    setHealthGoalsTool,
    listRecentMealsTool,
    getWeeklySummaryTool
  ];
};
