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

  async create(data: { name: string; email: string; password: string; role: 'admin' | 'support' | 'assistant' }) {
    const usersColl = getUsersCollection();

    const exists = await usersColl.findOne({ email: data.email.toLowerCase() });
    if (exists) throw new Error('El email ya está registrado');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const newUser: User = {
      _id: new ObjectId(),
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role,
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersColl.insertOne(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  async update(id: string, data: Partial<Pick<User, 'name' | 'email' | 'role' | 'status' | 'avatar'>>) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const usersColl = getUsersCollection();

    if (data.role === 'devadmin') {
      throw new Error('No se puede asignar el rol devadmin por API');
    }

    // Si se actualiza el email, verificar que no exista
    if (data.email) {
      const exists = await usersColl.findOne({ 
        email: data.email.toLowerCase(), 
        _id: { $ne: new ObjectId(id) } 
      });
      if (exists) throw new Error('El email ya está en uso por otro usuario');
      data.email = data.email.toLowerCase();
    }

    const result = await usersColl.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
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
