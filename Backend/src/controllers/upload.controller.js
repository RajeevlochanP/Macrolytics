export default class UploadController {
  constructor(uploadService) {
    this.uploadService = uploadService;
  }

  getPresignedUrl = async (req, res) => {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const { fileName, fileType, mealType } = req.body;
      
      if (!fileName || !fileType || !mealType) {
        return res.status(400).json({ error: 'fileName, fileType, and mealType are required' });
      }

      const { url, key, jobId } = await this.uploadService.generatePresignedUrl(userId, mealType, fileName, fileType);
      res.json({ url, key, jobId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
  }
}
