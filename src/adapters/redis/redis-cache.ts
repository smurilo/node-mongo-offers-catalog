import type { Redis } from 'ioredis';
import type { Cache } from '../../application/ports.js';

export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  get(key: string) {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  /** SCAN instead of KEYS so invalidation never blocks Redis on a large keyspace. */
  async invalidatePrefix(prefix: string) {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
      if (keys.length) await this.redis.unlink(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}
