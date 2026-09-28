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

  async updateDetails(id: string, projectId: string, changes: Partial<Pick<Appointment, 'date' | 'time' | 'service' | 'notes'>>) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(projectId)) throw new Error('ID inválido');
    const filter = { _id: new ObjectId(id), projectId: new ObjectId(projectId) };
    const update: Record<string, unknown> = { ...changes, updatedAt: new Date() };
    if (changes.date || changes.time) {
      const current = await getAppointmentsCollection().findOne(filter);
      if (!current) return null;
      const date = changes.date ? new Date(changes.date) : new Date(current.date);
      const time = changes.time ?? current.time;
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      }
      update.date = date;
    }
    return getAppointmentsCollection().findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: 'after' }
    );
  },

  async updateStatus(id: string, status: AppointmentStatus, projectId?: string) {
    if (!ObjectId.isValid(id)) throw new Error('ID inválido');
    const filter: Record<string, unknown> = { _id: new ObjectId(id) };
    if (projectId) {
      if (!ObjectId.isValid(projectId)) throw new Error('ID de proyecto inválido');
      filter.projectId = new ObjectId(projectId);
    }
    const result = await getAppointmentsCollection().findOneAndUpdate(
      filter,
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },
};
