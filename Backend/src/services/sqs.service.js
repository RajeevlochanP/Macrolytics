import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export default class SqsListenerService {
  constructor(aiService, redisClient, nutritionDao) {
    this.aiService = aiService;
    this.redisClient = redisClient;
    this.nutritionDao = nutritionDao;
    this.queueUrl = process.env.AWS_SQS_QUEUE_URL;
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    this.isPolling = false;
  }

  start() {
    this.isPolling = true;
    console.log(`Starting SQS Listener on ${this.queueUrl}`);
    this.poll();
  }

  stop() {
    this.isPolling = false;
  }

  async poll() {
    while (this.isPolling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages) {
          for (const message of response.Messages) {
            await this.processMessage(message);
            
            await this.sqsClient.send(new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: message.ReceiptHandle
            }));
          }
        }
      } catch (error) {
        console.error('Error polling SQS:', error);
        // Add a small delay on error to prevent tight looping
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }

  async processMessage(message) {
    try {
      const body = JSON.parse(message.Body);
      
      // Handle SNS wrapping or direct S3 events
      const records = body.Records || (body.Message ? JSON.parse(body.Message).Records : null);
      
      if (!records) return;

      for (const record of records) {
        if (record.eventName && record.eventName.startsWith('ObjectCreated:')) {
          const rawKey = record.s3.object.key;
          // AWS URL-encodes S3 object keys and replaces spaces with '+'
          const s3Key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
          
          // uploads/{userId}/{mealType}/{jobId}-{fileName}
          const parts = s3Key.split('/');
          if (parts.length >= 4) {
            const userId = parts[1];
            const mealType = parts[2];
            const filePart = parts.slice(3).join('/');
            
            // Extract jobId from {jobId}-{fileName}
            const jobId = filePart.substring(0, 36);
            
            if (jobId) {
              const isNew = await this.redisClient.setNX(`job:${jobId}:lock`, '1');
              await this.redisClient.expire(`job:${jobId}:lock`, 3600);
              
              if (!isNew) {
                continue;
              }

              await this.redisClient.hSet(`job:${jobId}`, {
                state: 'PROCESSING'
              });
              
              await this.nutritionDao.createProcessingStub(userId, mealType, jobId);
              
              await this.aiService.queue.add('extract', {
                userId,
                s3Key,
                mealType
              }, { jobId });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing SQS message:', error);
    }
  }
}
