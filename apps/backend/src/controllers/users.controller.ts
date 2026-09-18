import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { z } from 'zod';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.q as string || '';
    const role = req.query.role as string;
    const status = req.query.status as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string || 'desc') as 'asc' | 'desc';

    const users = await userService.findAll({ page, limit, search, role, status, sortBy, sortOrder });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'support', 'assistant']),
  projectIds: z.array(z.string()).optional(),
});

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await userService.create(data);
    res.status(201).json(user);
  } catch (error: any) {
    if (error.message === 'El email ya está registrado') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'support', 'assistant']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  avatar: z.string().optional().nullable(),
  projectIds: z.array(z.string()).optional(),
});

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateUserSchema.parse(req.body);
    // Convert null avatar to undefined for the service
    const cleanData = { ...data, avatar: data.avatar ?? undefined };
    const user = await userService.update(req.params.id, cleanData);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    if (error.message?.includes('email ya está en uso')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};
