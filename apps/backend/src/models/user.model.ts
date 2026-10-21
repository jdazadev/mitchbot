import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  password: string; // Hash bcrypt
  role: 'admin' | 'support' | 'assistant' | 'approver';
  avatar?: string;
  status: 'Active' | 'Inactive';
  projectIds?: ObjectId[];       // Proyectos a los que pertenece el usuario
  activeProjectId?: ObjectId;    // Proyecto activo del usuario
  lastLoginAt?: Date;
  /** Tipos de notificación push activados (`false` = desactivado; ausente = activado). */
  pushPreferences?: Partial<Record<string, boolean>>;
  createdAt: Date;
  updatedAt: Date;
}

export const getUsersCollection = () => {
  return getDatabase().collection<User>('users');
};
