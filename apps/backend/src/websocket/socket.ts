import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ObjectId } from 'mongodb';
import { logger } from '../utils/logger';
import { socketAuthMiddleware } from '../middleware/socket-auth.middleware';
import { chatService } from '../services/chat.service';
import { getConversationsCollection } from '../models/conversation.model';
import redisClient from '../config/redis';
import env from '../config/env';

let io: Server;

/**
 * Rate limiting para WebSocket events
 * Usa Redis para almacenar contadores
 */
const wsRateLimiter = {
  async check(socket: Socket, event: string, maxPoints: number, duration: number): Promise<boolean> {
    try {
      const identifier = socket.data.userId || socket.handshake.address;
      const key = `ws:rate:${identifier}:${event}`;
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, duration);
      }
      return current <= maxPoints;
    } catch (error) {
      logger.error('[WS] Rate limiter error:', error);
      return true; // Fallback: permitir si Redis falla
    }
  }
};

/**
 * Configuración de CORS basada en entorno
 */
const getCorsOrigins = () => {
  if (env.NODE_ENV === 'development') {
    return ['*'];
  }
  
  // En producción, usar FRONTEND_URL
  const origins = env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map(o => o.trim()) : [];
  return origins.length > 0 ? origins : ['http://localhost:5173'];
};

export const initSocket = (httpServer: HttpServer) => {
  const corsOrigins = getCorsOrigins();
  
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware de autenticación para TODAS las conexiones
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket) => {
    logger.info(`[WS] Socket connected: ${socket.id}, isPublic: ${socket.data.isPublic || false}`);

    // Unir el socket a la room de su proyecto para eventos scoped por proyecto
    if (socket.data.projectId) {
      socket.join(projectRoom(socket.data.projectId));
    }

    // Evento: Unirse a una room (conversación)
    socket.on('join:room', async (roomId: string) => {
      try {
        // 1. Rate limiting
        const allowed = await wsRateLimiter.check(socket, 'join', 10, 60); // 10 joins/min
        if (!allowed) {
          socket.emit('error', { message: 'Demasiadas conexiones. Intenta más tarde.', code: 'RATE_LIMITED' });
          return;
        }

        // 2. Validar roomId
        if (!roomId || !ObjectId.isValid(roomId)) {
          socket.emit('error', { message: 'ID de conversación inválido', code: 'INVALID_ROOM' });
          return;
        }

        // 3. Verificar que la conversación existe y pertenece al proyecto
        const conversation = await getConversationsCollection().findOne({
          _id: new ObjectId(roomId),
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversación no encontrada', code: 'ROOM_NOT_FOUND' });
          return;
        }

        // 4. Para usuarios autenticados: verificar que la conversación pertenece a su proyecto
        if (!socket.data.isPublic) {
          const projectId = socket.data.projectId;
          if (conversation.projectId && conversation.projectId.toString() !== projectId) {
            logger.warn(`[WS] Socket ${socket.id} intentó acceder a conversación de otro proyecto`);
            socket.emit('error', { message: 'No tienes acceso a esta conversación', code: 'ACCESS_DENIED' });
            return;
          }

          // 5. Verificar estado de la conversación según rol
          if (socket.data.role === 'assistant' && conversation.status !== 'active') {
            socket.emit('error', { message: 'Conversación no está activa', code: 'NOT_ACTIVE' });
            return;
          }
        }

        // 6. Unirse a la room
        socket.join(roomId);
        logger.info(`[WS] Socket ${socket.id} joined room ${roomId}`);
        socket.emit('joined:room', { roomId, success: true });

      } catch (error: any) {
        logger.error(`[WS] Error joining room: ${error.message}`, { socketId: socket.id, roomId });
        socket.emit('error', { message: 'Error al unirse a la conversación', code: 'JOIN_ERROR' });
      }
    });

    // Evento: Enviar mensaje (rate limited)
    socket.on('chat:send', async (data: { conversationId: string; content: string }) => {
      try {
        // 1. Rate limiting
        const allowed = await wsRateLimiter.check(socket, 'send', 30, 60); // 30 msg/min
        if (!allowed) {
          socket.emit('error', { message: 'Demasiados mensajes. Intenta más tarde.', code: 'RATE_LIMITED' });
          return;
        }

        // 2. Verificar que está en la room
        if (!socket.rooms.has(data.conversationId)) {
          socket.emit('error', { message: 'No estás en esta conversación', code: 'NOT_IN_ROOM' });
          return;
        }

        // 3. Validar datos
        if (!data.conversationId || !data.content?.trim()) {
          socket.emit('error', { message: 'Datos de mensaje inválidos', code: 'INVALID_DATA' });
          return;
        }

        // 4. Emitir el mensaje a la room (el backend procesará el mensaje vía API)
        socket.to(data.conversationId).emit('chat:typing', { userId: socket.data.userId });

      } catch (error: any) {
        logger.error(`[WS] Error in chat:send: ${error.message}`, { socketId: socket.id });
        socket.emit('error', { message: 'Error al procesar mensaje', code: 'SEND_ERROR' });
      }
    });

    // Evento: Confirmación / cancelación / modificación de una herramienta
    socket.on('tool:confirm', async (data: { conversationId: string; executionId: string; action?: 'confirm' | 'cancel' | 'modify'; params?: any }) => {
      try {
        const allowed = await wsRateLimiter.check(socket, 'tool_confirm', 20, 60);
        if (!allowed) {
          socket.emit('error', { message: 'Demasiadas solicitudes. Intenta más tarde.', code: 'RATE_LIMITED' });
          return;
        }

        if (!data?.executionId) {
          socket.emit('error', { message: 'Datos de confirmación inválidos', code: 'INVALID_DATA' });
          return;
        }

        const result = await chatService.handleToolConfirmation({
          conversationId: data.conversationId,
          executionId: data.executionId,
          action: data.action || 'confirm',
          params: data.params,
          userId: socket.data.userId,
        });

        socket.emit('tool:confirmed', { executionId: data.executionId, status: result?.status });
      } catch (error: any) {
        logger.error(`[WS] Error in tool:confirm: ${error.message}`, { socketId: socket.id });
        socket.emit('error', { message: error.message || 'Error al confirmar la acción', code: 'TOOL_CONFIRM_ERROR' });
      }
    });

    // Evento: Typing indicator
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (socket.rooms.has(data.conversationId)) {
        socket.to(data.conversationId).emit('chat:typing', {
          userId: socket.data.userId,
          isTyping: data.isTyping,
        });
      }
    });

    // Desconexión
    socket.on('disconnect', (reason) => {
      logger.info(`[WS] Socket disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Manejo de errores del socket
    socket.on('error', (error) => {
      logger.error(`[WS] Socket error: ${error.message}`, { socketId: socket.id });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

/** Room lógica asociada a un proyecto */
export const projectRoom = (projectId: string) => `project:${projectId}`;

/**
 * Emitir un evento a todos los sockets conectados a un proyecto.
 * Evita que clientes de otros proyectos reciban el evento.
 */
export const emitToProject = (projectId: string | undefined, event: string, data: any) => {
  if (!projectId) return;
  try {
    const io = getIO();
    io.to(projectRoom(projectId)).emit(event, data);
  } catch (error: any) {
    logger.error(`[WS] Error emitting to project ${projectId}: ${error.message}`);
  }
};

/**
 * Emitir un evento a una room específica
 * Wrapper seguro para emitir eventos
 */
export const emitToRoom = (roomId: string, event: string, data: any) => {
  try {
    const io = getIO();
    io.to(roomId).emit(event, data);
  } catch (error: any) {
    logger.error(`[WS] Error emitting to room ${roomId}: ${error.message}`);
  }
};

/**
 * Emitir un evento a todos los sockets conectados
 * Usar con precaución - solo para eventos globales
 */
export const emitToAll = (event: string, data: any) => {
  try {
    const io = getIO();
    io.emit(event, data);
  } catch (error: any) {
    logger.error(`[WS] Error emitting to all: ${error.message}`);
  }
};
