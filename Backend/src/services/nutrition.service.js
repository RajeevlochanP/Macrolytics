import { getLocalYMD } from '../utils/date.js';

export default class NutritionService {
  constructor(nutritionDao, redisClient) {
    this.nutritionDao = nutritionDao;
    this.redisClient = redisClient;
  }

  async logMeal(userId, entryData, timeZone = 'UTC') {
    // Save to DB
    const entry = await this.nutritionDao.createFoodEntry({ ...entryData, user_id: userId });

    // Update Redis Cache for Daily Aggregation
    const dateStr = entryData.date || getLocalYMD(entry.logged_at || new Date(), timeZone); // YYYY-MM-DD
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;

    // Use HINCRBYFLOAT for atomic updates without full table scans
    await this.redisClient.hIncrByFloat(redisKey, 'calories', entry.calories || 0);
    await this.redisClient.hIncrByFloat(redisKey, 'protein', entry.protein || 0);
    await this.redisClient.hIncrByFloat(redisKey, 'carbs', entry.carbs || 0);
    await this.redisClient.hIncrByFloat(redisKey, 'fat', entry.fat || 0);

    // Set expiry for 30 days if not set
    await this.redisClient.expire(redisKey, 60 * 60 * 24 * 30, 'NX');

    return entry;
  }

  async updateMeal(id, userId, updates, timeZone = 'UTC') {
    const oldEntry = await this.nutritionDao.getFoodEntryById(id, userId);
    if (!oldEntry) throw new Error('Entry not found');

    const updatedEntry = await this.nutritionDao.updateFoodEntry(id, userId, updates);
    
    // Update Redis Cache with delta
    const dateStr = getLocalYMD(oldEntry.logged_at, timeZone);
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    
    const deltaCalories = (updatedEntry.calories || 0) - (oldEntry.calories || 0);
    const deltaProtein = (updatedEntry.protein || 0) - (oldEntry.protein || 0);
    const deltaCarbs = (updatedEntry.carbs || 0) - (oldEntry.carbs || 0);
    const deltaFat = (updatedEntry.fat || 0) - (oldEntry.fat || 0);

    // Only update if key exists (otherwise it will rebuild correctly next time)
    const exists = await this.redisClient.exists(redisKey);
    if (exists) {
      if (deltaCalories !== 0) await this.redisClient.hIncrByFloat(redisKey, 'calories', deltaCalories);
      if (deltaProtein !== 0) await this.redisClient.hIncrByFloat(redisKey, 'protein', deltaProtein);
      if (deltaCarbs !== 0) await this.redisClient.hIncrByFloat(redisKey, 'carbs', deltaCarbs);
      if (deltaFat !== 0) await this.redisClient.hIncrByFloat(redisKey, 'fat', deltaFat);
    }
    
    return updatedEntry;
  }

  async deleteMeal(id, userId, timeZone = 'UTC') {
    const oldEntry = await this.nutritionDao.getFoodEntryById(id, userId);
    if (!oldEntry) throw new Error('Entry not found');

    await this.nutritionDao.deleteFoodEntry(id, userId);

    // Update Redis Cache with negative delta
    const dateStr = getLocalYMD(oldEntry.logged_at, timeZone);
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    
    const exists = await this.redisClient.exists(redisKey);
    if (exists) {
      await this.redisClient.hIncrByFloat(redisKey, 'calories', -(oldEntry.calories || 0));
      await this.redisClient.hIncrByFloat(redisKey, 'protein', -(oldEntry.protein || 0));
      await this.redisClient.hIncrByFloat(redisKey, 'carbs', -(oldEntry.carbs || 0));
      await this.redisClient.hIncrByFloat(redisKey, 'fat', -(oldEntry.fat || 0));
    }
    
    return true;
  }

  async getDailySummary(userId, dateStr, timeZone = 'UTC') {
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    const cached = await this.redisClient.hGetAll(redisKey);
    if (Object.keys(cached).length > 0) {
      return cached;
    }
    
    // If not in cache, calculate from DB (fallback)
    const entries = await this.nutritionDao.getEntriesByDateRange(userId, dateStr, dateStr, timeZone);
    
    const summary = entries.reduce((acc, curr) => {
      acc.calories += Number(curr.calories);
      acc.protein += Number(curr.protein);
      acc.carbs += Number(curr.carbs);
      acc.fat += Number(curr.fat);
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    if (entries.length > 0) {
      await this.redisClient.hSet(redisKey, summary);
      await this.redisClient.expire(redisKey, 60 * 60 * 24 * 30);
    }
    return summary;
  }

  async getFoodEntries(userId, limit, lastLoggedAt, lastId) {
    return this.nutritionDao.getFoodEntries(userId, limit, lastLoggedAt, lastId);
  }

  async checkGoals(userId, dateStr, timeZone = 'UTC') {
    const goals = await this.nutritionDao.getHealthGoals(userId);
    const summary = await this.getDailySummary(userId, dateStr, timeZone);
    return { goals, summary };
  }

  async getHealthGoals(userId) {
    return this.nutritionDao.getHealthGoals(userId);
  }

  async setHealthGoals(userId, goalData) {
    return this.nutritionDao.upsertHealthGoal({ ...goalData, user_id: userId });
  }

  async getWeeklyReport(userId, dateStr, timeZone = 'UTC') {
    const [y, m, d] = dateStr.split('-');
    const endDateObj = new Date(y, m - 1, d);
    
    const startDateObj = new Date(endDateObj);
    startDateObj.setDate(startDateObj.getDate() - 6);
    
    const formatDate = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const startDateStr = formatDate(startDateObj);

    const aggregation = await this.nutritionDao.getWeeklyAggregation(userId, startDateStr, dateStr, timeZone);
    
    // Fill in missing days with zeros
    const report = [];
    for (let i = 0; i < 7; i++) {
      const dObj = new Date(startDateObj);
      dObj.setDate(dObj.getDate() + i);
      const dStr = formatDate(dObj);
      
      const dayData = aggregation.find(row => row.date_str === dStr);
      if (dayData) {
        report.push({
          date: dStr,
          calories: Number(dayData.total_calories),
          protein: Number(dayData.total_protein),
          carbs: Number(dayData.total_carbs),
          fat: Number(dayData.total_fat)
        });
      } else {
        report.push({ date: dStr, calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    }
    
    return report;
  }
}
