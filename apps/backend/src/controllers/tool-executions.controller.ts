import { Request, Response, NextFunction } from 'express';
import { ToolExecutionStatus } from '../models/tool-execution.model';
import { toolExecutionService } from '../services/tool-execution.service';
import { chatService } from '../services/chat.service';

const statuses: ToolExecutionStatus[] = ['pending_confirmation', 'pending_approval', 'executing', 'approving', 'executed', 'approved', 'rejected', 'failed', 'cancelled'];

export const listToolExecutions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ error: 'Rango de fechas inválido' });
    }
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !statuses.includes(status as ToolExecutionStatus)) return res.status(400).json({ error: 'Estado inválido' });
    const result = await toolExecutionService.list({
      projectId,
      toolId: req.query.tool as string | undefined,
      operation: req.query.operation as string | undefined,
      binding: req.query.binding as string | undefined,
      status: status as ToolExecutionStatus | undefined,
      from, to,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const listPendingToolExecutions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });
    const items = await toolExecutionService.listPending(projectId);
    res.json({ items, total: items.length });
  } catch (error) {
    next(error);
  }
};

export const resolveToolExecution = (decision: 'approved' | 'rejected') => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    const userId = (req as any).userId as string | undefined;
    if (!projectId || !userId) return res.status(404).json({ error: 'No hay proyecto configurado' });
    const result = await chatService.resolveToolApproval(req.params.id, projectId, userId, decision);
    if (!result) return res.status(404).json({ error: 'Solicitud pendiente no encontrada' });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
