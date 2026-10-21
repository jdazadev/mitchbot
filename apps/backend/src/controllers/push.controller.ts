import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import env from '../config/env';
import { getPushSubscriptionsCollection } from '../models/push-subscription.model';
import { getUsersCollection } from '../models/user.model';
import { isAllowedEndpoint, PUSH_KINDS, validKeys } from '../services/push-policy';
import { allowedPushHosts, pushConfigured } from '../services/push.service';
import { enqueuePush } from '../queues/push-notifications';

const userIdOf = (req: Request) => new ObjectId((req as any).userId as string);

/** GET /api/push/config — clave pública VAPID (o push desactivado) */
export const getPushConfig = (_req: Request, res: Response) => {
  res.json(pushConfigured() ? { enabled: true, publicKey: env.VAPID_PUBLIC_KEY } : { enabled: false });
};

/** GET /api/push/me — preferencias y dispositivos del usuario */
export const getMyPush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const endpoints = await getPushSubscriptionsCollection()
      .find({ userId: userIdOf(req) }, { projection: { endpoint: 1 } })
      .toArray();
    res.json({
      preferences: Object.fromEntries(PUSH_KINDS.map(kind => [kind, user?.pushPreferences?.[kind] !== false])),
      devices: endpoints.length,
      endpoints: endpoints.map(s => s.endpoint),
    });
  } catch (error) {
    next(error);
  }
};

const subscriptionSchema = z.object({
  endpoint: z.string().max(2048),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** POST /api/push/subscriptions — registra (o reasigna) el navegador del usuario */
export const subscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!pushConfigured()) return res.status(409).json({ error: 'El servidor no tiene las notificaciones push configuradas' });
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success || !validKeys(parsed.data.keys)) return res.status(400).json({ error: 'Suscripción push inválida' });
    if (!isAllowedEndpoint(parsed.data.endpoint, allowedPushHosts())) {
      return res.status(400).json({ error: 'El proveedor de notificaciones push no está permitido' });
    }
    const now = new Date();
    await getPushSubscriptionsCollection().updateOne(
      { endpoint: parsed.data.endpoint },
      {
        $set: { userId: userIdOf(req), keys: parsed.data.keys, userAgent: req.get('user-agent')?.slice(0, 300), updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    res.status(201).json({ subscribed: true });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/push/subscriptions — da de baja el navegador del usuario */
export const unsubscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    const result = await getPushSubscriptionsCollection().deleteOne({ endpoint, userId: userIdOf(req) });
    res.json({ removed: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

const preferencesSchema = z.object(Object.fromEntries(PUSH_KINDS.map(kind => [kind, z.boolean().optional()]))).strict();

/** PUT /api/push/preferences — tipos de notificación activados */
export const updatePushPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Preferencias inválidas' });
    const set = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined).map(([k, v]) => [`pushPreferences.${k}`, v]));
    if (Object.keys(set).length) await getUsersCollection().updateOne({ _id: userIdOf(req) }, { $set: set });
    const user = await getUsersCollection().findOne({ _id: userIdOf(req) }, { projection: { pushPreferences: 1 } });
    res.json(Object.fromEntries(PUSH_KINDS.map(kind => [kind, user?.pushPreferences?.[kind] !== false])));
  } catch (error) {
    next(error);
  }
};

/** POST /api/push/test — push de prueba a los dispositivos del usuario, aunque tenga el panel abierto */
export const sendTestPush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!pushConfigured()) return res.status(409).json({ error: 'El servidor no tiene las notificaciones push configuradas' });
    const devices = await getPushSubscriptionsCollection().countDocuments({ userId: userIdOf(req) });
    if (!devices) return res.status(409).json({ error: 'No hay dispositivos suscritos' });
    await enqueuePush({
      userIds: [userIdOf(req).toString()],
      notification: { kind: 'team', message: 'Así se verán las notificaciones de Mitchbot.', level: 'info' },
    });
    res.status(202).json({ queued: true, devices });
  } catch (error) {
    next(error);
  }
};
