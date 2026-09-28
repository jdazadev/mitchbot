import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  _id?: ObjectId;
  projectId: ObjectId;
  conversationId: ObjectId;
  contactId?: ObjectId;
  amount: number;
  currency: string;
  method: string;
  reference?: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const getPaymentsCollection = () => getDatabase().collection<Payment>('payments');
