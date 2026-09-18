import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  password: string; // Hash bcrypt
  role: 'devadmin' | 'admin' | 'support' | 'assistant';
  avatar?: string;
  status: 'Active' | 'Inactive';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const getUsersCollection = () => {
  return getDatabase().collection<User>('users');
};
