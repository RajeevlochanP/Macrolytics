export default class AiController {
  constructor(aiService) {
    this.aiService = aiService;
  }

  extractNutrition = async (req, res) => {
    try {
      // Assuming userId is coming from authentication middleware
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const { s3Key, mealType } = req.body;
      
      if (!s3Key || !mealType) {
        return res.status(400).json({ error: 's3Key and mealType are required' });
      }

      const { jobId } = await this.aiService.extractNutrition(userId, s3Key, mealType);
      res.status(202).json({ jobId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to enqueue extraction job' });
    }
  }

  getJobStatus = async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await this.aiService.queue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const state = await job.getState();
      const result = job.returnvalue;
      const failedReason = job.failedReason;
      
      res.json({ id: jobId, state, result, failedReason });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  }
}
