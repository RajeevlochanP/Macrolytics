import { Queue, QueueEvents } from 'bullmq';

export default class AiService {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.queue = new Queue('nutrition-extraction', { 
      connection: redisClient
    });
    this.queueEvents = new QueueEvents('nutrition-extraction', {
      connection: redisClient
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
