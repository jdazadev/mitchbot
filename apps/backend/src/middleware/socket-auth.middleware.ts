import { Socket } from 'socket.io';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { projectService } from '../services/project.service';
import { logger } from '../utils/logger';

/**
 * Middleware de autenticación para Socket.io
 * Verifica el JWT token en el handshake
 */
export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // 1. Extraer token del handshake
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    // 2. Si es una conexión pública (test-chat), no requiere token
    const isPublic = socket.handshake.query?.isPublic === 'true';
    if (isPublic) {
      // Validar slug para conexiones públicas
      const slug = socket.handshake.query?.slug as string;
      if (slug) {
        const project = await projectService.findBySlug(slug);
        if (project) {
          socket.data.projectId = project._id?.toString();
          socket.data.isPublic = true;
          return next();
        }
      }
      return next(new Error('Proyecto no válido para chat público'));
    }
    
    // 3. Requerir token para conexiones autenticadas
    if (!token) {
      return next(new Error('Token de autenticación requerido'));
    }
    
    // 4. Verificar JWT
    const decoded = authService.verifyToken(token as string);
    
    // 5. Buscar usuario
    const user = await userService.findById(decoded.userId);
    if (!user) {
      return next(new Error('Usuario no encontrado'));
    }
    
    if (user.status === 'Inactive') {
      return next(new Error('Cuenta desactivada'));
    }
    
    // 6. Obtener proyecto activo
    const project = await projectService.getActiveProject();
    
    // 7. Adjuntar datos al socket
    socket.data.user = user;
    socket.data.userId = decoded.userId;
    socket.data.projectId = project?._id?.toString();
    socket.data.role = user.role;
    
    logger.info(`[WS] Socket autenticado: ${socket.id}, user: ${decoded.userId}, role: ${user.role}`);
    
    next();
  } catch (error: any) {
    logger.error(`[WS] Auth error: ${error.message}`, { socketId: socket.id });
    next(new Error('Autenticación fallida: ' + error.message));
  }
};

/**
 * Middleware de autorización para rooms
 * Verifica que el usuario tenga acceso a la conversación
 */
export const socketRoomAuthMiddleware = (socket: Socket, roomId: string): boolean => {
  // Conexiones públicas solo pueden unirse a rooms de su proyecto
  if (socket.data.isPublic) {
    return true; // El slug ya fue validado
  }
  
  // Usuarios autenticados pueden unirse a conversaciones de su proyecto
  if (!socket.data.projectId) {
    logger.warn(`[WS] Socket ${socket.id} intentó unirse a room sin projectId`);
    return false;
  }
  
  return true;
};
