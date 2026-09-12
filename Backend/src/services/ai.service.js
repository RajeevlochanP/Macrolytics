import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export default class AiService {
  constructor(redisClient) {
    this.redisClient = redisClient;
    
    // BullMQ requires ioredis, node-redis is incompatible
    const bullConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { 
      maxRetriesPerRequest: null 
    });

    this.queue = new Queue('nutrition-extraction', { 
      connection: bullConnection
    });
    this.queueEvents = new QueueEvents('nutrition-extraction', {
      connection: bullConnection
    });

    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        await this.redisClient.hSet(`job:${jobId}`, {
          state: 'COMPLETED',
          result: JSON.stringify(returnvalue)
        });
      } catch (err) {
        console.error(`Failed to update redis for completed job ${jobId}`, err);
      }
    });

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        await this.redisClient.hSet(`job:${jobId}`, {
          state: 'FAILED',
          failedReason: failedReason
        });
      } catch (err) {
        console.error(`Failed to update redis for failed job ${jobId}`, err);
      }
    });
  }
}
