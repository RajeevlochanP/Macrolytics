import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default class UploadService {
  constructor(s3Client) {
    this.s3Client = s3Client;
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  async generatePresignedUrl(fileName, fileType) {
    const key = `uploads/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType
    });

    // URL valid for 5 minutes
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    return { url, key };
  }
}
