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
      const entry = await this.nutritionService.logMeal(userId, entryData);
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

      let entries = [];
      if (startDate && endDate) {
        entries = await this.nutritionService.nutritionDao.getEntriesByDateRange(userId, startDate, endDate);
      } else {
        entries = await this.nutritionService.getFoodEntries(userId, parseInt(limit), lastLoggedAt, lastId);
      }
      
      res.json(entries);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch food entries' });
    }
  }

  getGoals = async (req, res) => {
    try {
      const userId = req.user.id;
      const goals = await this.nutritionService.getHealthGoals(userId);
      if (!goals) {
        return res.status(404).json({ error: 'Health goals not found for user' });
      }
      res.json(goals);
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
      // Default to today if date not provided
      const date = req.query.date || new Date().toISOString().split('T')[0];
      
      const report = await this.nutritionService.getWeeklyReport(userId, date);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch weekly report' });
    }
  }
}
