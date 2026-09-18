import { connect, NatsConnection } from 'nats';
import env from './env';
import { logger } from '../utils/logger';

let natsConnection: NatsConnection;

export const connectNats = async () => {
  if (!env.NATS_URL) {
    logger.warn('⚠️ NATS_URL not defined, skipping NATS connection');
    return false;
  }
  
  try {
    natsConnection = await connect({ servers: env.NATS_URL });
    logger.info('✅ NATS connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ NATS connection error:', error);
    return false;
  }
};

export const getNatsConnection = () => {
  if (!natsConnection) {
    throw new Error('NATS connection not initialized');
  }
  return natsConnection;
};

export const closeNats = async () => {
  if (natsConnection) {
    await natsConnection.close();
  }
};
