import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import env from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectQdrant } from './config/qdrant';
import { initSocket } from './websocket/socket';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { projectContextService } from './services/project-context.service';
import './queues/rag-upload.worker';
import { createReindexWorker } from './queues/rag-reindex.worker';
import { createInboundWorker } from './channels/inbound';
import { createOutboundWorkers } from './channels/outbound';
import { registerWhatsApp } from './channels/whatsapp';
import { registerInstagram } from './channels/instagram';
import { createSlaAlertWorker } from './queues/sla-alerts';
import { serveLoader, WIDGET_ASSETS_DIR } from './controllers/widget.controller';

const app = express();
const httpServer = createServer(app);

// Infrastructure
(async () => {
    try {
        console.log('\n--- 🔌 Initializing Backend Infrastructure ---');
        
        // Parallel or sequential initialization based on criticality
        const [mongo, redis, qdrant] = await Promise.allSettled([
            connectDatabase().then(() => true).catch(() => false),
            connectRedis().then(() => true).catch(() => false),
            connectQdrant().then(() => true).catch(() => false)
        ]);
        
        console.log('\n--- 📊 Infrastructure Status Report ---');
        console.table({
            MongoDB: (mongo.status === 'fulfilled' && mongo.value) ? '✅ Connected' : '❌ Failed',
            Redis: (redis.status === 'fulfilled' && redis.value) ? '✅ Connected' : '❌ Failed',
            Qdrant: (qdrant.status === 'fulfilled' && qdrant.value) ? '✅ Connected' : '❌ Failed',
        });
        console.log('---------------------------------------\n');

        // Seed project context if MongoDB connected
        if (mongo.status === 'fulfilled' && mongo.value) {
          try {
            await projectContextService.ensureProjectContext();
          } catch (e) {
            console.warn('⚠️ Could not initialize project context:', e);
          }
        }

        // Start background reindex worker (Redis/BullMQ)
        try {
          createReindexWorker({ concurrency: 1 });
        } catch (e) {
          console.warn('⚠️ Could not start RAG reindex worker:', e);
        }

        // Pasarela de canales: entrada de webhooks y entrega por canal externo
        try {
          registerWhatsApp();
          registerInstagram();
          createInboundWorker();
          createOutboundWorkers();
          createSlaAlertWorker();
        } catch (e) {
          console.warn('⚠️ Could not start channel workers:', e);
        }

        // Initialize Socket.io
        initSocket(httpServer);
        
        // Middleware
        app.use(cors());
        // Los webhooks firman el cuerpo tal como llega: se conserva el original para verificarlo.
        app.use(express.json({
          verify: (req, _res, buf) => {
            if (req.url?.startsWith('/api/webhooks/')) (req as any).rawBody = buf;
          },
        }));
        
        // Widget embebible: cargador y recursos estáticos de su página
        app.get('/widget.js', serveLoader);
        app.use('/widget', express.static(WIDGET_ASSETS_DIR, { maxAge: '5m', index: false }));

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
