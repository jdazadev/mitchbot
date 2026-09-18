import { ObjectId } from 'mongodb';
import { getOrdersCollection, Order, OrderItem, OrderStatus } from '../models/order.model';

export interface CreateOrderInput {
  projectId?: string;
  conversationId?: string;
  contactId?: string;
  items: OrderItem[];
  currency?: string;
  notes?: string;
  status?: OrderStatus;
  createdBy?: Order['createdBy'];
}

function toObjectId(value?: string): ObjectId | undefined {
  return value && ObjectId.isValid(value) ? new ObjectId(value) : undefined;
}

function normalizeItems(items: OrderItem[]): OrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('El pedido debe incluir al menos un artículo');
  }
  return items.map(item => ({
    name: String(item?.name || '').trim() || 'Artículo',
    quantity: Number(item?.quantity) > 0 ? Number(item.quantity) : 1,
    price: item?.price !== undefined && item?.price !== null ? Number(item.price) : undefined,
  }));
}

export const orderService = {
  async create(input: CreateOrderInput): Promise<Order> {
    const items = normalizeItems(input.items);
    const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    const order: Order = {
      _id: new ObjectId(),
      projectId: toObjectId(input.projectId),
      conversationId: toObjectId(input.conversationId),
      contactId: toObjectId(input.contactId),
      items,
      total,
      currency: input.currency || 'USD',
      status: input.status || 'pending',
      notes: input.notes,
      createdBy: input.createdBy || 'ai_agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await getOrdersCollection().insertOne(order);
    return order;
  },

  async findAll(projectId?: string, status?: OrderStatus) {
    const query: any = {};
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    if (status) query.status = status;
    return getOrdersCollection().find(query).sort({ createdAt: -1 }).toArray();
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('ID inválido');
    return getOrdersCollection().findOne({ _id: new ObjectId(id) });
  },

  async updateStatus(id: string, status: OrderStatus) {
    if (!ObjectId.isValid(id)) throw new Error('ID inválido');
    const result = await getOrdersCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },
};
