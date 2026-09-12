import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export default class UploadService {
  constructor(s3Client, redisClient) {
    this.s3Client = s3Client;
    this.redisClient = redisClient;
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  async generatePresignedUrl(userId, mealType, fileName, fileType, timeZone = 'UTC') {
    const jobId = uuidv4();
    const key = `uploads/${userId}/${mealType}/${jobId}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType
    });

    // URL valid for 5 minutes
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    
    // Set initial status in Redis
    await this.redisClient.hSet(`job:${jobId}`, {
      state: 'AWAITING_UPLOAD',
      timeZone
    });
    
    return { url, key, jobId };
  }
}
