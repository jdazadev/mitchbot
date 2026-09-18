import env from './env';
import type { ConnectionOptions } from 'bullmq';

const redisUrl = new URL(env.REDIS_URL);

const bullmqConnection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

export default bullmqConnection;
