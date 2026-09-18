import { ObjectId } from 'mongodb';
import { getAppointmentsCollection, Appointment, AppointmentStatus } from '../models/appointment.model';

export interface CreateAppointmentInput {
  projectId?: string;
  conversationId?: string;
  contactId?: string;
  date: Date | string;
  time?: string;
  service: string;
  notes?: string;
  status?: AppointmentStatus;
  createdBy?: Appointment['createdBy'];
}

function toObjectId(value?: string): ObjectId | undefined {
  return value && ObjectId.isValid(value) ? new ObjectId(value) : undefined;
}

export const appointmentService = {
  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const date = input.date instanceof Date ? input.date : new Date(input.date);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Fecha de cita inválida');
    }

    const appointment: Appointment = {
      _id: new ObjectId(),
      projectId: toObjectId(input.projectId),
      conversationId: toObjectId(input.conversationId),
      contactId: toObjectId(input.contactId),
      date,
      time: input.time,
      service: input.service,
      status: input.status || 'pending',
      notes: input.notes,
      createdBy: input.createdBy || 'ai_agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await getAppointmentsCollection().insertOne(appointment);
    return appointment;
  },

  async findAll(projectId?: string, status?: AppointmentStatus) {
    const query: any = {};
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    if (status) query.status = status;
    return getAppointmentsCollection().find(query).sort({ date: 1 }).toArray();
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('ID inválido');
    return getAppointmentsCollection().findOne({ _id: new ObjectId(id) });
  },

  async findByDate(projectId: string | undefined, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const query: any = { date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    return getAppointmentsCollection().find(query).sort({ date: 1 }).toArray();
  },

  async updateStatus(id: string, status: AppointmentStatus) {
    if (!ObjectId.isValid(id)) throw new Error('ID inválido');
    const result = await getAppointmentsCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },
};
