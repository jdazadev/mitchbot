import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getVolume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly') || 'daily';
    const data = await analyticsService.getVolume(period);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getChannelDistribution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getChannelDistribution();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getRecentActivity();
    res.json(data);
  } catch (error) {
    next(error);
  }
};
