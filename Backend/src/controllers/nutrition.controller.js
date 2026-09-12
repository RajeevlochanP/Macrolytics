import { getLocalYMD } from '../utils/date.js';

export default class NutritionController {
  constructor(nutritionService) {
    this.nutritionService = nutritionService;
  }

  createEntry = async (req, res) => {
    try {
      const userId = req.user.id;
      const entryData = req.body;

      if (!entryData.meal_type || !entryData.item_name || !entryData.quantity || !entryData.calories) {
        return res.status(400).json({ error: 'Missing required fields: meal_type, item_name, quantity, calories' });
      }

      // NOTE: We call logMeal on the service so Redis cache logic runs automatically
      const timeZone = req.headers['x-timezone'] || 'UTC';
      const entry = await this.nutritionService.logMeal(userId, entryData, timeZone);
      res.status(201).json(entry);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create food entry' });
    }
  }

  getEntries = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 20, lastLoggedAt, lastId, startDate, endDate } = req.query;

      const timeZone = req.headers['x-timezone'] || 'UTC';

      let entries = [];
      if (startDate && endDate) {
        entries = await this.nutritionService.nutritionDao.getEntriesByDateRange(userId, startDate, endDate, timeZone);
      } else {
        entries = await this.nutritionService.getFoodEntries(userId, parseInt(limit), lastLoggedAt, lastId);
      }
      
      res.json(entries);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch food entries' });
    }
  }

  updateEntry = async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const updates = req.body;
      const timeZone = req.headers['x-timezone'] || 'UTC';
      
      const updated = await this.nutritionService.updateMeal(id, userId, updates, timeZone);
      res.json(updated);
    } catch (error) {
      console.error(error);
      if (error.message === 'Entry not found') {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.status(500).json({ error: 'Failed to update food entry' });
    }
  }

  deleteEntry = async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const timeZone = req.headers['x-timezone'] || 'UTC';
      
      await this.nutritionService.deleteMeal(id, userId, timeZone);
      res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
      console.error(error);
      if (error.message === 'Entry not found') {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.status(500).json({ error: 'Failed to delete food entry' });
    }
  }

  getGoals = async (req, res) => {
    try {
      const userId = req.user.id;
      const date = req.query.date;
      const timeZone = req.headers['x-timezone'] || 'UTC';

      if (date) {
        const result = await this.nutritionService.checkGoals(userId, date, timeZone);
        res.json(result);
      } else {
        const goals = await this.nutritionService.getHealthGoals(userId);
        if (!goals) {
          return res.status(404).json({ error: 'Health goals not found for user' });
        }
        res.json(goals);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch health goals' });
    }
  }

  updateGoals = async (req, res) => {
    try {
      const userId = req.user.id;
      const goalData = req.body;
      
      if (!goalData.daily_calorie_target || !goalData.protein_grams || !goalData.carb_grams || !goalData.fat_grams) {
        return res.status(400).json({ error: 'Missing required macros for health goals' });
      }

      const updatedGoals = await this.nutritionService.setHealthGoals(userId, goalData);
      res.json(updatedGoals);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update health goals' });
    }
  }

  getWeeklyReport = async (req, res) => {
    try {
      const userId = req.user.id;
      const timeZone = req.headers['x-timezone'] || 'UTC';
      // Default to today if localDate not provided
      const date = req.query.localDate || req.query.date || getLocalYMD(new Date(), timeZone);
      
      const report = await this.nutritionService.getWeeklyReport(userId, date, timeZone);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch weekly report' });
    }
  }
}
