import pool from '../config/db.js';

export default class NutritionDao {
  
  async createFoodEntry(entryData) {
    const query = `
      INSERT INTO food_entries 
        (user_id, meal_type, item_name, quantity, quantity_unit, calories, protein, carbs, fat, micros, image_url)
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
      entryData.micros ? JSON.stringify(entryData.micros) : null,
      entryData.image_url || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async createProcessingStub(userId, mealType, jobId) {
    const query = `
      INSERT INTO food_entries (user_id, meal_type, status, job_id, item_name, quantity, calories, protein, carbs, fat)
      VALUES ($1, $2, 'PROCESSING', $3, 'Analyzing image...', 0, 0, 0, 0, 0)
      RETURNING *
    `;
    const result = await pool.query(query, [userId, mealType, jobId]);
    return result.rows[0];
  }

  async updateEntryFromJob(jobId, updates) {
    const query = `
      UPDATE food_entries 
      SET 
        item_name = $1,
        quantity = $2,
        quantity_unit = $3,
        calories = $4,
        protein = $5,
        carbs = $6,
        fat = $7,
        micros = $8,
        status = 'COMPLETED'
      WHERE job_id = $9
      RETURNING *
    `;
    const values = [
      updates.item_name,
      updates.quantity,
      updates.quantity_unit,
      updates.calories,
      updates.protein,
      updates.carbs,
      updates.fat,
      updates.micros ? JSON.stringify(updates.micros) : null,
      jobId
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async markJobFailed(jobId) {
    const query = `UPDATE food_entries SET status = 'FAILED' WHERE job_id = $1 RETURNING *`;
    const result = await pool.query(query, [jobId]);
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

  async getEntriesByDateRange(userId, startDateStr, endDateStr, timeZone = 'UTC') {
    const query = `
      SELECT * FROM food_entries 
      WHERE user_id = $1 
        AND DATE(logged_at AT TIME ZONE $4) >= $2 
        AND DATE(logged_at AT TIME ZONE $4) <= $3 
      ORDER BY logged_at DESC
    `;
    const result = await pool.query(query, [userId, startDateStr, endDateStr, timeZone]);
    return result.rows;
  }

  async getWeeklyAggregation(userId, startDateStr, endDateStr, timeZone = 'UTC') {
    const query = `
      SELECT 
        TO_CHAR(logged_at AT TIME ZONE $4, 'YYYY-MM-DD') as date_str,
        SUM(calories) as total_calories,
        SUM(protein) as total_protein,
        SUM(carbs) as total_carbs,
        SUM(fat) as total_fat
      FROM food_entries
      WHERE user_id = $1 
        AND DATE(logged_at AT TIME ZONE $4) >= $2 
        AND DATE(logged_at AT TIME ZONE $4) <= $3
      GROUP BY TO_CHAR(logged_at AT TIME ZONE $4, 'YYYY-MM-DD')
      ORDER BY TO_CHAR(logged_at AT TIME ZONE $4, 'YYYY-MM-DD') ASC
    `;
    const result = await pool.query(query, [userId, startDateStr, endDateStr, timeZone]);
    return result.rows;
  }

  async getFoodEntryById(id, userId) {
    const query = `SELECT * FROM food_entries WHERE id = $1 AND user_id = $2`;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  async updateFoodEntry(id, userId, updates) {
    const query = `
      UPDATE food_entries 
      SET 
        quantity = $1,
        calories = $2,
        protein = $3,
        carbs = $4,
        fat = $5
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `;
    const values = [
      updates.quantity,
      updates.calories,
      updates.protein,
      updates.carbs,
      updates.fat,
      id,
      userId
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deleteFoodEntry(id, userId) {
    const query = `DELETE FROM food_entries WHERE id = $1 AND user_id = $2 RETURNING *`;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }
}
