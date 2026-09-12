import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

export default class AiService {
  constructor(redisClient) {
    this.queue = new Queue('nutrition-extraction', { 
      connection: redisClient
    });
  }

  async extractNutrition(userId, s3Key, mealType) {
    const jobId = uuidv4();
    await this.queue.add('extract', {
      userId,
      s3Key,
      mealType
    }, { jobId });
    
    return { jobId };
  }
}
