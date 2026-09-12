import './config/env.js';

const requiredEnvs = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'REDIS_URL', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
  'S3_BUCKET_NAME', 'JWT_SECRET', 'CONTEXT_ENCRYPTION_KEY'
];

for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.error(`FATAL ERROR: Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

import express from 'express';
import cookieParser from 'cookie-parser';
import db from './config/db.js';
import redisClient from './config/redis.js';
import s3Client from './config/s3.js';

// DAOs
import NutritionDao from './daos/nutrition.dao.js';
import AuthDao from './daos/auth.dao.js';

// Services
import NutritionService from './services/nutrition.service.js';
import UploadService from './services/upload.service.js';
import AiService from './services/ai.service.js';
import AuthService from './services/auth.service.js';
import SqsListenerService from './services/sqs.service.js';

// Controllers
import UploadController from './controllers/upload.controller.js';
import AiController from './controllers/ai.controller.js';
import AgentController from './controllers/agent.controller.js';
import AuthController from './controllers/auth.controller.js';
import NutritionController from './controllers/nutrition.controller.js';

// Routes
import { createApiRouter } from './routes/api.js';

// Agent
import { createAgentGraph } from './agent/graph.js';

const app = express();
app.use(express.json());
app.use(cookieParser());

// Dependency Injection Setup
const nutritionDao = new NutritionDao();
const authDao = new AuthDao();

const nutritionService = new NutritionService(nutritionDao, redisClient);
const uploadService = new UploadService(s3Client, redisClient);
const aiService = new AiService(redisClient);
const authService = new AuthService(authDao);
const sqsListenerService = new SqsListenerService(aiService, redisClient, nutritionDao);

const uploadController = new UploadController(uploadService);
const aiController = new AiController(aiService, redisClient);
const authController = new AuthController(authService);
const nutritionController = new NutritionController(nutritionService);

// Agent setup
let agentController;
const setupAgent = async () => {
  const graph = await createAgentGraph(nutritionService, authService);
  agentController = new AgentController(graph, authService);
  await agentController.initialize();

  // Routes
  app.use('/api', createApiRouter(authController, uploadController, aiController, agentController, nutritionController));
};

// Start Server
const PORT = process.env.PORT || 3000;

setupAgent().then(() => {
  // Start the background SQS listener
  sqsListenerService.start();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server", err);
  process.exit(1);
});
