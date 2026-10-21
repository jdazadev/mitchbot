import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getUsersCollection, User } from '../models/user.model';

interface FindAllOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const userService = {
  async findAll(options: FindAllOptions = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const usersColl = getUsersCollection();
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && role !== 'All') query.role = role;
    if (status && status !== 'All') query.status = status;

    const skip = (page - 1) * limit;
    const sortField = ['name', 'email', 'role', 'status', 'createdAt'].includes(sortBy) ? sortBy : 'createdAt';
    const sort: any = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      usersColl.find(query, { projection: { password: 0 } }) // Nunca devolver password
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .toArray(),
      usersColl.countDocuments(query),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const user = await getUsersCollection().findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );
    return user;
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'support' | 'assistant' | 'approver';
    projectIds?: string[];
  }) {
    const usersColl = getUsersCollection();

    const exists = await usersColl.findOne({ email: data.email.toLowerCase() });
    if (exists) throw new Error('El email ya está registrado');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const projectIds = (data.projectIds || [])
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));

    const newUser: User = {
      _id: new ObjectId(),
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role,
      status: 'Active',
      projectIds,
      activeProjectId: projectIds[0],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersColl.insertOne(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  async update(
    id: string,
    data: Partial<Omit<User, 'projectIds' | 'activeProjectId'>> & {
      projectIds?: string[] | ObjectId[];
      activeProjectId?: ObjectId | string;
    }
  ) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const usersColl = getUsersCollection();

    const updateData: any = { ...data };

    // Si se actualiza el email, verificar que no exista
    if (data.email) {
      const exists = await usersColl.findOne({ 
        email: data.email.toLowerCase(), 
        _id: { $ne: new ObjectId(id) } 
      });
      if (exists) throw new Error('El email ya está en uso por otro usuario');
      updateData.email = data.email.toLowerCase();
    }

    if (data.projectIds) {
      const projectIds = data.projectIds
        .map(pid => (pid instanceof ObjectId ? pid : new ObjectId(pid as string)))
        .filter(pid => ObjectId.isValid(pid));
      updateData.projectIds = projectIds;

      const current = await usersColl.findOne({ _id: new ObjectId(id) });
      const activeId = current?.activeProjectId?.toString();
      if (!activeId || !projectIds.some(pid => pid.toString() === activeId)) {
        updateData.activeProjectId = projectIds[0];
      }
    }

    const result = await usersColl.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updateData, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );
    return result;
  },

  /**
   * Añade el usuario a un proyecto y lo deja como activo en una sola operación
   * atómica: dos proyectos creados a la vez no se pisan la membresía.
   */
  async joinProject(id: string, projectId: string) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(projectId)) throw new Error('Invalid ID');
    const project = new ObjectId(projectId);
    return getUsersCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $addToSet: { projectIds: project }, $set: { activeProjectId: project, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );
  },

  /** Establece el proyecto activo de un usuario (validando pertenencia) */
  async setActiveProject(id: string, projectId: string) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(projectId)) throw new Error('Invalid ID');
    const usersColl = getUsersCollection();
    const user = await usersColl.findOne({ _id: new ObjectId(id) });
    if (!user) throw new Error('Usuario no encontrado');

    const isMember = (user.projectIds || []).some(pid => pid.toString() === projectId);
    if (!isMember) throw new Error('El usuario no pertenece a ese proyecto');

    const result = await usersColl.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { activeProjectId: new ObjectId(projectId), updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );
    return result;
  },

  async updatePassword(id: string, newPassword: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const result = await getUsersCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );
    return result.matchedCount === 1;
  },
};
