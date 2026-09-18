import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { OrderStatus } from '../models/order.model';

const VALID_STATUS: OrderStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export const listOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });

    const status = req.query.status as OrderStatus | undefined;
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const orders = await orderService.findAll(projectId, status);
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const order = await orderService.updateStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};
