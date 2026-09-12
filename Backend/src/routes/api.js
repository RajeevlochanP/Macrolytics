import { Router } from 'express';

export const createApiRouter = (uploadController, aiController, agentController) => {
  const router = Router();

  router.post('/uploads/presigned-url', uploadController.getPresignedUrl);
  
  router.post('/ai/extract-nutrition', aiController.extractNutrition);
  router.get('/jobs/:jobId', aiController.getJobStatus);
  
  router.post('/agent/chat', agentController.chat);

  return router;
};
