import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

/** Suscripción Web Push de un navegador; el `endpoint` es único. */
export interface PushSubscription {
  _id?: ObjectId;
  userId: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSuccessAt?: Date;
}

export const getPushSubscriptionsCollection = () => getDatabase().collection<PushSubscription>('push_subscriptions');
