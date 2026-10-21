import { emitToProject } from '../websocket/socket';
import { enqueuePush } from '../queues/push-notifications';
import { logger } from '../utils/logger';
import type { PushKind } from './push-policy';

export interface ProjectNotification {
  kind: PushKind;
  message: string;
  level: 'info' | 'warning' | 'urgent' | 'error';
  conversationId?: string;
  toolExecutionId?: string;
  [extra: string]: unknown;
}

/**
 * Notificación para el equipo del proyecto: llega al topbar de quien tiene el
 * panel abierto (`admin:notification`) y por push al resto. Nunca lanza: una
 * notificación que falla no debe romper el flujo que la provoca.
 */
export function notifyProject(projectId: string | undefined, notification: ProjectNotification) {
  if (!projectId) return;
  emitToProject(projectId, 'admin:notification', { ...notification, projectId, createdAt: new Date() });
  void enqueuePush({
    projectId,
    notification: {
      kind: notification.kind,
      message: notification.message,
      level: notification.level,
      conversationId: notification.conversationId,
      toolExecutionId: notification.toolExecutionId,
    },
  }).catch(error => logger.warn(`[Push] No se pudo encolar la notificación: ${error?.message || error}`));
}
