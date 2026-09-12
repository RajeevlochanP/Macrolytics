import express from 'express';
import dotenv from 'dotenv';
import db from './config/db.js';
import redisClient from './config/redis.js';
import s3Client from './config/s3.js';

// DAOs
import NutritionDao from './daos/nutrition.dao.js';

// Services
import NutritionService from './services/nutrition.service.js';
import UploadService from './services/upload.service.js';
import AiService from './services/ai.service.js';

// Controllers
import UploadController from './controllers/upload.controller.js';
import AiController from './controllers/ai.controller.js';
import AgentController from './controllers/agent.controller.js';

// Routes
import { createApiRouter } from './routes/api.js';

// Agent & Workers
import { createAgentGraph } from './agent/graph.js';
import { getCheckpointer } from './agent/checkpointer.js';
import { startWorker } from './workers/nutrition.worker.js';

dotenv.config();

const app = express();
app.use(express.json());

// Dependency Injection Setup
const nutritionDao = new NutritionDao();
const nutritionService = new NutritionService(nutritionDao, redisClient);
const uploadService = new UploadService(s3Client);
const aiService = new AiService(redisClient);

const uploadController = new UploadController(uploadService);
const aiController = new AiController(aiService);

// Agent setup
let agentController;
const setupAgent = async () => {
  const checkpointer = await getCheckpointer();
  const graph = await createAgentGraph(nutritionService);
  agentController = new AgentController(graph, checkpointer);
  await agentController.initialize();
  
  // Routes
  app.use('/api/v1', createApiRouter(uploadController, aiController, agentController));
};

// Start Server
const PORT = process.env.PORT || 3000;

setupAgent().then(() => {
  // Start the background worker
  startWorker();
  
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server", err);
  process.exit(1);
});
