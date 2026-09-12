import db from '../config/db.js';

export default class AuthDao {
  async createUser(email, passwordHash) {
    const query = `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, preferences, created_at
    `;
    const result = await db.query(query, [email, passwordHash]);
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await db.query(query, [email]);
    return result.rows[0];
  }

  async updateUserPreferences(userId, key, value) {
    const query = `
      UPDATE users 
      SET preferences = jsonb_set(preferences, array[$2], $3::jsonb, true)
      WHERE id = $1
      RETURNING preferences
    `;
    const result = await db.query(query, [userId, key, JSON.stringify(value)]);
    return result.rows[0];
  }

  async getUserPreferences(userId) {
    const query = `SELECT preferences FROM users WHERE id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0]?.preferences || {};
  }
}
