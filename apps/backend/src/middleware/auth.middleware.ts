import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';

/**
 * Middleware de autenticación JWT.
 * Verifica el token en el header Authorization: Bearer <token>
 *
 * Resuelve el proyecto de la petición desde el header `X-Project-Id`
 * (validando que el usuario sea miembro) o, en su defecto, desde el
 * `activeProjectId` del usuario.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    const user = await userService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    const memberProjectIds = (user.projectIds || []).map(id => id.toString());
    const headerProjectId = (req.headers['x-project-id'] as string | undefined)?.trim();

    let resolvedProjectId: string | undefined;

    if (headerProjectId) {
      if (!memberProjectIds.includes(headerProjectId)) {
        return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
      }
      resolvedProjectId = headerProjectId;
    } else if (user.activeProjectId && memberProjectIds.includes(user.activeProjectId.toString())) {
      resolvedProjectId = user.activeProjectId.toString();
    } else if (memberProjectIds.length > 0) {
      resolvedProjectId = memberProjectIds[0];
    }

    (req as any).user = user;
    (req as any).userId = decoded.userId;
    (req as any).projectId = resolvedProjectId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

/**
 * Middleware de autorización por rol.
 * Uso: authorize('admin', 'support')
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};
