import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getUsersCollection, User } from '../models/user.model';
import env from '../config/env';

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

export const authService = {
  /**
   * Registrar un nuevo usuario.
   * El primer usuario registrado se convierte en admin automáticamente.
   */
  async register(data: { name: string; email: string; password: string }) {
    const usersColl = getUsersCollection();

    // Verificar email duplicado
    const existingUser = await usersColl.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Si no hay usuarios, el primer usuario es admin
    const userCount = await usersColl.countDocuments();
    const role = userCount === 0 ? 'admin' : 'support';

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const newUser: User = {
      _id: new ObjectId(),
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: role as 'admin' | 'support' | 'assistant' | 'approver',
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersColl.insertOne(newUser);

    const token = this.generateToken(newUser);
    const { password, ...userWithoutPassword } = newUser;

    return { user: userWithoutPassword, token };
  },

  async login(email: string, password: string) {
    const usersColl = getUsersCollection();

    const user = await usersColl.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    if (user.status === 'Inactive') {
      throw new Error('Tu cuenta está desactivada');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Credenciales inválidas');
    }

    // Actualizar último login
    await usersColl.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  },

  generateToken(user: User) {
    return jwt.sign(
      { userId: user._id!.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  },

  verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
    } catch {
      throw new Error('Token inválido');
    }
  },

  /** Verifica la contraseña actual de un usuario */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const usersColl = getUsersCollection();
    const user = await usersColl.findOne({ _id: new ObjectId(userId) });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  },
};
