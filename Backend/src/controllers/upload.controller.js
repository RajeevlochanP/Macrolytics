export default class UploadController {
  constructor(uploadService) {
    this.uploadService = uploadService;
  }

  getPresignedUrl = async (req, res) => {
    try {
      const { fileName, fileType } = req.body;
      if (!fileName || !fileType) {
        return res.status(400).json({ error: 'fileName and fileType are required' });
      }

      const { url, key } = await this.uploadService.generatePresignedUrl(fileName, fileType);
      res.json({ url, key });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
  }
}
