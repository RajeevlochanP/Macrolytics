import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mealTypeEnum } from '../models/schemas.js';

export const createTools = (nutritionService, authService) => {
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

  const savePermanentPreferenceTool = tool(
    async (input) => {
      try {
        await authService.updateUserPreferences(input.userId, input.key, input.value);
        return `Successfully saved preference '${input.key}' as '${JSON.stringify(input.value)}'.`;
      } catch (e) {
        return `Error saving preference: ${e.message}`;
      }
    },
    {
      name: 'save_permanent_preference',
      description: 'Saves a permanent dietary restriction, preference, allergy, or long-term goal for the user to their permanent profile.',
      schema: z.object({
        userId: z.string().uuid(),
        key: z.string(),
        value: z.any()
      })
    }
  );

  const setHealthGoalsTool = tool(
    async (input) => {
      try {
        await nutritionService.setHealthGoals(input.userId, {
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
        userId: z.string().uuid(),
        daily_calorie_target: z.number().int().positive(),
        protein_grams: z.number().int().nonnegative(),
        carb_grams: z.number().int().nonnegative(),
        fat_grams: z.number().int().nonnegative(),
        weight_goal: z.number().positive().optional()
      })
    }
  );

  const listRecentMealsTool = tool(
    async (input) => {
      try {
        const entries = await nutritionService.getFoodEntries(input.userId, input.limit || 10);
        return JSON.stringify(entries);
      } catch (e) {
        return `Error listing recent meals: ${e.message}`;
      }
    },
    {
      name: 'list_recent_meals',
      description: 'Retrieve a list of the user\'s recently logged food entries and meals.',
      schema: z.object({
        userId: z.string().uuid(),
        limit: z.number().int().positive().optional()
      })
    }
  );

  const getWeeklySummaryTool = tool(
    async (input) => {
      try {
        const report = await nutritionService.getWeeklyReport(input.userId, input.endDate);
        return JSON.stringify(report);
      } catch (e) {
        return `Error getting weekly summary: ${e.message}`;
      }
    },
    {
      name: 'get_weekly_summary',
      description: 'Retrieve a daily aggregation of calories and macros for the past 7 days ending on the specified date.',
      schema: z.object({
        userId: z.string().uuid(),
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
