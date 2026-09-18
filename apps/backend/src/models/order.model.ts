import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

export interface Order {
  _id?: ObjectId;
  projectId?: ObjectId;
  conversationId?: ObjectId;
  contactId?: ObjectId;
  items: OrderItem[];
  total: number;
  currency?: string;
  status: OrderStatus;
  notes?: string;
  createdBy?: 'ai_agent' | 'human_agent' | 'contact';
  createdAt: Date;
  updatedAt: Date;
}

export const getOrdersCollection = () => {
  return getDatabase().collection<Order>('orders');
};
