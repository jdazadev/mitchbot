import { Request, Response, NextFunction } from 'express';
import { contactService } from '../services/contact.service';
import { z } from 'zod';

export const listContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.q as string || '';
    const platform = req.query.platform as string;
    const status = req.query.status as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string || 'desc') as 'asc' | 'desc';
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const contacts = await contactService.findAll({ 
      page, limit, search, platform, status, sortBy, sortOrder, tags, includeArchived
    });

    res.json(contacts);
  } catch (error) {
    next(error);
  }
};

export const getContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await contactService.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    next(error);
  }
};

// No hay endpoint público de crear contacto.
// Los contactos se crean automáticamente al contestar el primer mensaje del cliente.
// Ver: chatService.ensureContactCreated()

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional(),
  platform: z.enum(['WhatsApp', 'Instagram', 'Web']).optional(),
  status: z.enum(['Active', 'New', 'Inactive']).optional(), // No se puede poner Archived vía update
  avatar: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  metadata: z.object({
    location: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
    totalOrders: z.number().optional().nullable(),
    identifier: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional(),
});

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateContactSchema.parse(req.body);
    const updated = await contactService.update(req.params.id, data as any);
    if (!updated) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Archivar contacto (soft delete). No se elimina de la base de datos.
 */
export const archiveContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const archived = await contactService.archive(req.params.id);
    if (!archived) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact archived', contact: archived });
  } catch (error) {
    next(error);
  }
};

/**
 * Restaurar contacto archivado.
 */
export const restoreContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restored = await contactService.restore(req.params.id);
    if (!restored) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact restored', contact: restored });
  } catch (error) {
    next(error);
  }
};
