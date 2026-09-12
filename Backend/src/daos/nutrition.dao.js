import pool from '../config/db.js';

export default class NutritionDao {
  
  async createFoodEntry(entryData) {
    const query = `
      INSERT INTO food_entries 
        (user_id, meal_type, item_name, quantity, quantity_unit, calories, protein, carbs, fat, micronutrients, image_url)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      entryData.micronutrients ? JSON.stringify(entryData.micronutrients) : null,
      entryData.image_url || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getFoodEntries(userId, limit = 20, lastLoggedAt = null, lastId = null) {
    let query;
    let values;

    if (lastLoggedAt && lastId) {
      query = `
        SELECT * FROM food_entries
        WHERE user_id = $1 AND (logged_at, id) < ($2, $3)
        ORDER BY logged_at DESC, id DESC
        LIMIT $4
      `;
      values = [userId, lastLoggedAt, lastId, limit];
    } else {
      query = `
        SELECT * FROM food_entries
        WHERE user_id = $1
        ORDER BY logged_at DESC, id DESC
        LIMIT $2
      `;
      values = [userId, limit];
    }
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  async getHealthGoals(userId) {
    const query = `SELECT * FROM health_goals WHERE user_id = $1 LIMIT 1`;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async upsertHealthGoal(goalData) {
    const query = `
      INSERT INTO health_goals 
        (user_id, daily_calorie_target, protein_grams, carb_grams, fat_grams, weight_goal)
      VALUES 
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET 
        daily_calorie_target = EXCLUDED.daily_calorie_target,
        protein_grams = EXCLUDED.protein_grams,
        carb_grams = EXCLUDED.carb_grams,
        fat_grams = EXCLUDED.fat_grams,
        weight_goal = EXCLUDED.weight_goal
      RETURNING *
    `;
    const values = [
      goalData.user_id,
      goalData.daily_calorie_target,
      goalData.protein_grams,
      goalData.carb_grams,
      goalData.fat_grams,
      goalData.weight_goal || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getEntriesByDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM food_entries 
      WHERE user_id = $1 AND logged_at >= $2 AND logged_at <= $3 
      ORDER BY logged_at DESC
    `;
    const result = await pool.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}
