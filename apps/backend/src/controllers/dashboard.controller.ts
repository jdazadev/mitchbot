import { Request, Response, NextFunction } from 'express';
import { analyticsService, type DateRange, type VolumePeriod } from '../services/analytics.service';

const VOLUME_PERIODS: VolumePeriod[] = ['daily', 'weekly', 'monthly'];

function toValidDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Resuelve el rango de fechas desde `from`/`to` o `days` (por defecto sin rango). */
function parseRange(req: Request): DateRange {
  const from = toValidDate(req.query.from);
  const to = toValidDate(req.query.to);
  if (from || to) return { from, to };

  const days = Number(req.query.days);
  if (Number.isFinite(days) && days > 0) {
    const rangeTo = new Date();
    const rangeFrom = new Date();
    rangeFrom.setDate(rangeFrom.getDate() - days);
    return { from: rangeFrom, to: rangeTo };
  }
  return {};
}

/**
 * Obtiene el proyecto resuelto por el middleware `authenticate`.
 * Sin proyecto no se calculan métricas; responde 403 y devuelve null.
 */
function resolveProjectId(req: Request, res: Response): string | null {
  const projectId = (req as any).projectId as string | undefined;
  if (!projectId) {
    res.status(403).json({ error: 'Proyecto no resuelto' });
    return null;
  }
  return projectId;
}

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = resolveProjectId(req, res);
    if (!projectId) return;
    const stats = await analyticsService.getStats(projectId, parseRange(req));
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getVolume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = resolveProjectId(req, res);
    if (!projectId) return;
    const requested = req.query.period as VolumePeriod;
    const period = VOLUME_PERIODS.includes(requested) ? requested : 'daily';
    const data = await analyticsService.getVolume(projectId, period, parseRange(req));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getChannelDistribution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = resolveProjectId(req, res);
    if (!projectId) return;
    const data = await analyticsService.getChannelDistribution(projectId, parseRange(req));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = resolveProjectId(req, res);
    if (!projectId) return;
    const data = await analyticsService.getRecentActivity(projectId);
    res.json(data);
  } catch (error) {
    next(error);
  }
};
