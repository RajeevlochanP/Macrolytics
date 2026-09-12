import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const createApiRouter = (authController, uploadController, aiController, agentController) => {
  const router = Router();

  // Public Routes
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);

  // Protected Routes
  router.use(authMiddleware);
  
  router.post('/uploads/presigned-url', uploadController.getPresignedUrl);
  
  router.post('/ai/extract-nutrition', aiController.extractNutrition);
  router.get('/jobs/:jobId', aiController.getJobStatus);
  
  router.post('/agent/chat', agentController.chat);

  return router;
};

