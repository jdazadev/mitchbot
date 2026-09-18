import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  _id?: ObjectId;
  projectId?: ObjectId;
  conversationId?: ObjectId;
  contactId?: ObjectId;
  date: Date;            // Fecha y hora de inicio
  time?: string;         // "15:00"
  service: string;
  status: AppointmentStatus;
  notes?: string;
  createdBy?: 'ai_agent' | 'human_agent' | 'contact';
  createdAt: Date;
  updatedAt: Date;
}

export const getAppointmentsCollection = () => {
  return getDatabase().collection<Appointment>('appointments');
};
