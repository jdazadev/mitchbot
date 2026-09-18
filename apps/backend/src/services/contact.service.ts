import { ObjectId } from 'mongodb';
import { getContactsCollection, Contact } from '../models/contact.model';

interface FindAllOptions {
  page?: number;
  limit?: number;
  search?: string;
  platform?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  includeArchived?: boolean;
  projectId?: string;
}

export const contactService = {
  async findAll(options: FindAllOptions = {}) {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      platform, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      tags,
      includeArchived = false,
      projectId,
    } = options;

    const contactsColl = getContactsCollection();
    const query: any = {};

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    // Por defecto, excluir contactos archivados
    if (!includeArchived && status !== 'Archived') {
      query.status = { $ne: 'Archived' };
    }

    // Búsqueda por texto en nombre, email, teléfono
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtro por plataforma
    if (platform && platform !== 'All') {
      query.platform = platform;
    }

    // Filtro por status (sobreescribe el filtro de archivados si se pide explícitamente)
    if (status && status !== 'All') {
      query.status = status;
    }

    // Filtro por tags
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    const skip = (page - 1) * limit;

    // Construir el sort object
    const sortField = ['name', 'email', 'phone', 'platform', 'status', 'createdAt', 'updatedAt', 'lastContactAt'].includes(sortBy) 
      ? sortBy 
      : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortDirection };

    const [items, total] = await Promise.all([
      contactsColl.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .toArray(),
      contactsColl.countDocuments(query),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  },

  async findById(id: string, projectId?: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const query: any = { _id: new ObjectId(id) };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    const contact = await getContactsCollection().findOne(query);
    return contact;
  },

  async findByIdentifier(identifier: string) {
    return getContactsCollection().findOne({
      $or: [
        { phone: identifier },
        { email: identifier },
        { 'metadata.identifier': identifier },
      ],
    });
  },

  /**
   * Crear contacto — solo uso INTERNO (auto-creación al contestar primer mensaje).
   * No debe exponerse como endpoint público.
   */
  async create(contactData: Omit<Contact, '_id' | 'createdAt' | 'updatedAt'>) {
    const contactsColl = getContactsCollection();
    const newContact: any = {
      ...contactData,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: contactData.tags || [],
    };
    const result = await contactsColl.insertOne(newContact);
    return { ...newContact, _id: result.insertedId };
  },

  async update(id: string, updateData: Partial<Contact>, projectId?: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const contactsColl = getContactsCollection();
    
    // No permitir sobrescribir _id, createdAt
    const { _id, createdAt, ...safeUpdateData } = updateData as any;

    const query: any = { _id: new ObjectId(id) };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);

    const result = await contactsColl.findOneAndUpdate(
      query,
      { $set: { ...safeUpdateData, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },

  /**
   * Archivar contacto (soft delete). No se elimina, solo cambia el status a "Archived".
   */
  async archive(id: string, projectId?: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const contactsColl = getContactsCollection();
    const query: any = { _id: new ObjectId(id) };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    const result = await contactsColl.findOneAndUpdate(
      query,
      { $set: { status: 'Archived' as const, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },

  /**
   * Restaurar contacto archivado.
   */
  async restore(id: string, projectId?: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const contactsColl = getContactsCollection();
    const query: any = { _id: new ObjectId(id) };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    const result = await contactsColl.findOneAndUpdate(
      query,
      { $set: { status: 'Active' as const, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },
};
