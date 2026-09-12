import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const createApiRouter = (authController, uploadController, aiController, agentController, nutritionController) => {
  const router = Router();

  // Public Routes
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);
  router.post('/auth/logout', authController.logout);

  // Protected Routes
  router.use(authMiddleware);
  
  router.post('/uploads/presigned-url', uploadController.getPresignedUrl);
  
  // Nutrition Routes
  router.post('/nutrition/entries', nutritionController.createEntry);
  router.get('/nutrition/entries', nutritionController.getEntries);
  router.put('/nutrition/entries/:id', nutritionController.updateEntry);
  router.delete('/nutrition/entries/:id', nutritionController.deleteEntry);
  router.get('/nutrition/goals', nutritionController.getGoals);
  router.put('/nutrition/goals', nutritionController.updateGoals);
  router.get('/nutrition/reports/weekly', nutritionController.getWeeklyReport);
  
  router.get('/jobs/:jobId', aiController.getJobStatus);
  
  router.post('/agent/chat', agentController.chat);

  return router;
};

