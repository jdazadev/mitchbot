import { Request, Response, NextFunction } from 'express';
import { configService } from '../services/config.service';

/** Obtiene todas las configuraciones */
export const getAllConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.getAll();
    res.json(config);
  } catch (error) {
    next(error);
  }
};

/** Obtiene una configuración por clave */
export const getConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const value = await configService.get(req.params.key);
    if (value === null) return res.status(404).json({ error: 'Config key not found' });
    res.json({ key: req.params.key, value });
  } catch (error) {
    next(error);
  }
};

/** Actualiza una configuración */
export const setConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });
    const result = await configService.set(req.params.key, value);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Actualiza múltiples configuraciones a la vez */
export const setAllConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await configService.setAll(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
