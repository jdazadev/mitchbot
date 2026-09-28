import { ObjectId } from 'mongodb';
import { getPaymentsCollection, Payment } from '../models/payment.model';

export const paymentService = {
  async create(input: { projectId: string; conversationId: string; contactId?: string; amount: number; currency?: string; method: string; reference?: string }) {
    if (!ObjectId.isValid(input.projectId) || !ObjectId.isValid(input.conversationId)) throw new Error('ID inválido');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El importe debe ser mayor que cero');
    const payment: Payment = {
      _id: new ObjectId(), projectId: new ObjectId(input.projectId), conversationId: new ObjectId(input.conversationId),
      contactId: input.contactId && ObjectId.isValid(input.contactId) ? new ObjectId(input.contactId) : undefined,
      amount: input.amount, currency: input.currency || 'USD', method: input.method.trim(), reference: input.reference,
      status: 'pending', createdAt: new Date(), updatedAt: new Date(),
    };
    await getPaymentsCollection().insertOne(payment);
    return payment;
  },

  async findByContact(projectId: string, contactId: string) {
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(contactId)) throw new Error('ID inválido');
    return getPaymentsCollection().find({ projectId: new ObjectId(projectId), contactId: new ObjectId(contactId) })
      .sort({ createdAt: -1 }).toArray();
  },
};
