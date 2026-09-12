export default class AiController {
  constructor(aiService, redisClient) {
    this.aiService = aiService;
    this.redisClient = redisClient;
  }

  getJobStatus = async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const jobData = await this.redisClient.hGetAll(`job:${jobId}`);
      
      if (!jobData || Object.keys(jobData).length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const state = jobData.state;
      let result = null;
      let failedReason = null;
      
      if (jobData.result) {
        try { result = JSON.parse(jobData.result); } catch (e) {}
      }
      if (jobData.failedReason) {
        failedReason = jobData.failedReason;
      }
      
      res.json({ id: jobId, state, result, failedReason });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  }
}
