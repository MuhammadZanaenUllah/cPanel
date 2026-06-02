import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import 'dotenv/config';

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const provisionQueue = new Queue('provision-account', { connection: redisConnection });
