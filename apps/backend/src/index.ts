import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import env from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectQdrant } from './config/qdrant';
import { connectNats } from './config/nats';
import { checkOllama } from './config/ollama';
import { initSocket } from './websocket/socket';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { aiModelService } from './services/ai-model.service';
import { projectContextService } from './services/project-context.service';
import './queues/rag-upload.worker';
import { createReindexWorker } from './queues/rag-reindex.worker';

const app = express();
const httpServer = createServer(app);

// Infrastructure
(async () => {
    try {
        console.log('\n--- 🔌 Initializing Backend Infrastructure ---');
        
        // Parallel or sequential initialization based on criticality
        const [mongo, redis, qdrant, nats, ollama] = await Promise.allSettled([
            connectDatabase().then(() => true).catch(() => false),
            connectRedis().then(() => true).catch(() => false),
            connectQdrant().then(() => true).catch(() => false),
            connectNats().then((res) => res).catch(() => false),
            checkOllama().then((res) => res).catch(() => false)
        ]);
        
        console.log('\n--- 📊 Infrastructure Status Report ---');
        console.table({
            MongoDB: (mongo.status === 'fulfilled' && mongo.value) ? '✅ Connected' : '❌ Failed',
            Redis: (redis.status === 'fulfilled' && redis.value) ? '✅ Connected' : '❌ Failed',
            Qdrant: (qdrant.status === 'fulfilled' && qdrant.value) ? '✅ Connected' : '❌ Failed',
            Ollama: (ollama.status === 'fulfilled' && ollama.value) ? '✅ Connected' : '❌ Failed',
            NATS: (nats.status === 'fulfilled' && nats.value) ? '✅ Connected' : '❌ Failed',
        });
        console.log('---------------------------------------\n');

        // Seed AI models if MongoDB connected
        if (mongo.status === 'fulfilled' && mongo.value) {
          try {
            await aiModelService.seedDefaults();
            await projectContextService.ensureProjectContext();
          } catch (e) {
            console.warn('⚠️ Could not seed AI models:', e);
          }
        }

        // Start background reindex worker (Redis/BullMQ)
        try {
          createReindexWorker({ concurrency: 1 });
        } catch (e) {
          console.warn('⚠️ Could not start RAG reindex worker:', e);
        }

        // Initialize Socket.io
        initSocket(httpServer);
        
        // Middleware
        app.use(cors());
        app.use(express.json());
        
        // Routes
        app.use('/api', apiRoutes);
        
        // Health Check
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', env: env.NODE_ENV });
        });
        
        // Global Error Handler
        app.use(errorHandler);
        
        // Start Server
        httpServer.listen(env.PORT, () => {
            logger.info(`🚀 Backend running at http://localhost:${env.PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
})();
