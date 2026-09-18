import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === 'El email ya está registrado') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Credenciales inválidas' || error.message === 'Tu cuenta está desactivada') {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

const updateProfileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const data = updateProfileSchema.parse(req.body);

    // Si quiere cambiar contraseña, verificar la actual
    if (data.newPassword) {
      if (!data.currentPassword) {
        return res.status(400).json({ error: 'Debes proporcionar tu contraseña actual' });
      }
      const isValid = await authService.verifyPassword(userId, data.currentPassword);
      if (!isValid) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }
      await userService.updatePassword(userId, data.newPassword);
    }

    // Actualizar nombre y email
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;

    let updatedUser;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await userService.update(userId, updateData);
    } else {
      updatedUser = await userService.findById(userId);
    }

    res.json(updatedUser);
  } catch (error: any) {
    if (error.message === 'El email ya está en uso por otro usuario') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

/** Logout — invalidación del token se hace en el frontend eliminando el token */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    next(error);
  }
};
