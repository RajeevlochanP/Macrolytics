import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mealTypeEnum } from '../models/schemas.js';

export const createTools = (nutritionService) => {
  const logMealTool = tool(
    async (input) => {
      try {
        const entry = await nutritionService.logMeal(input.userId, {
          meal_type: input.meal_type,
          item_name: input.item_name,
          quantity: input.quantity,
          quantity_unit: input.quantity_unit,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat
        });
        return `Successfully logged ${input.quantity} ${input.quantity_unit} of ${input.item_name}.`;
      } catch (e) {
        return `Error logging meal: ${e.message}`;
      }
    },
    {
      name: 'log_meal',
      description: 'Log a food entry or meal for a user.',
      schema: z.object({
        userId: z.string().uuid(),
        meal_type: mealTypeEnum,
        item_name: z.string(),
        quantity: z.number().positive(),
        quantity_unit: z.string(),
        calories: z.number().int().nonnegative(),
        protein: z.number().nonnegative(),
        carbs: z.number().nonnegative(),
        fat: z.number().nonnegative(),
      })
    }
  );

  const queryNutritionTool = tool(
    async (input) => {
      try {
        const summary = await nutritionService.getDailySummary(input.userId, input.date);
        return JSON.stringify(summary);
      } catch (e) {
        return `Error querying nutrition: ${e.message}`;
      }
    },
    {
      name: 'query_nutrition',
      description: 'Query aggregated daily nutrition for a given date (YYYY-MM-DD).',
      schema: z.object({
        userId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  );

  const checkGoalsTool = tool(
    async (input) => {
      try {
        const result = await nutritionService.checkGoals(input.userId, input.date);
        return JSON.stringify(result);
      } catch (e) {
        return `Error checking goals: ${e.message}`;
      }
    },
    {
      name: 'check_goals',
      description: 'Check a user\'s daily nutrition progress against their health goals for a specific date (YYYY-MM-DD).',
      schema: z.object({
        userId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  );

  return [logMealTool, queryNutritionTool, checkGoalsTool];
};
