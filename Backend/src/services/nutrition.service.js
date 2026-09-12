export default class NutritionService {
  constructor(nutritionDao, redisClient) {
    this.nutritionDao = nutritionDao;
    this.redisClient = redisClient;
  }

  async logMeal(userId, entryData) {
    // Save to DB
    const entry = await this.nutritionDao.createFoodEntry({ ...entryData, user_id: userId });

    // Update Redis Cache for Daily Aggregation
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

  async getDailySummary(userId, dateStr) {
    const redisKey = `nutrition:daily:${userId}:${dateStr}`;
    const cached = await this.redisClient.hGetAll(redisKey);
    if (Object.keys(cached).length > 0) {
      return cached;
    }
    
    // If not in cache, calculate from DB (fallback)
    const startDate = new Date(`${dateStr}T00:00:00Z`);
    const endDate = new Date(`${dateStr}T23:59:59Z`);
    const entries = await this.nutritionDao.getEntriesByDateRange(userId, startDate, endDate);
    
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

  async checkGoals(userId, dateStr) {
    const goals = await this.nutritionDao.getHealthGoals(userId);
    if (!goals) return { goals: null, summary: null };

    const summary = await this.getDailySummary(userId, dateStr);
    return { goals, summary };
  }

  async getHealthGoals(userId) {
    return this.nutritionDao.getHealthGoals(userId);
  }

  async setHealthGoals(userId, goalData) {
    return this.nutritionDao.upsertHealthGoal({ ...goalData, user_id: userId });
  }

  async getWeeklyReport(userId, dateStr) {
    // Generate report for the 7 days ending on dateStr
    const endDate = new Date(`${dateStr}T23:59:59Z`);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const aggregation = await this.nutritionDao.getWeeklyAggregation(userId, startDate, endDate);
    
    // Fill in missing days with zeros
    const report = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      
      const dayData = aggregation.find(row => row.date.toISOString().split('T')[0] === dStr);
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
