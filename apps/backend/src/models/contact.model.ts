import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface Contact {
  _id?: ObjectId;
  name: string;
  email?: string;
  phone: string;
  platform: "WhatsApp" | "Instagram" | "Web";
  status: "Active" | "New" | "Inactive" | "Archived"; // Archived = soft delete
  avatar?: string;
  tags: string[];
  metadata?: {
    location?: string;
    username?: string;
    totalOrders?: number;
    identifier?: string; // Identificador único del cliente (phone, email, etc.)
    notes?: string;
  };
  lastContactAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const getContactsCollection = () => {
    return getDatabase().collection<Contact>('contacts');
};
