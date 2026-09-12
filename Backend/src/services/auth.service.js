import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default class AuthService {
  constructor(authDao) {
    this.authDao = authDao;
    this.jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';
  }

  async registerUser(email, password) {
    const existingUser = await this.authDao.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.authDao.createUser(email, passwordHash);
    const token = this._generateToken(user);

    return { user, token };
  }

  async loginUser(email, password) {
    const user = await this.authDao.findUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = this._generateToken(user);
    // don't return the hash
    delete user.password_hash;
    
    return { user, token };
  }

  _generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  async updateUserPreferences(userId, key, value) {
    return await this.authDao.updateUserPreferences(userId, key, value);
  }

  async getUserPreferences(userId) {
    return await this.authDao.getUserPreferences(userId);
  }
}
