import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoOfferRepository } from '../src/adapters/mongo/mongo-offer-repository.js';
import { RedisCache } from '../src/adapters/redis/redis-cache.js';
import type { Offer } from '../src/domain/offer.js';

// MONGO_URL=mongodb://localhost:27017 REDIS_URL=redis://localhost:6379 npm test
const mongoUrl = process.env.MONGO_URL;
const redisUrl = process.env.REDIS_URL;

describe.skipIf(!mongoUrl || !redisUrl)('Mongo + Redis adapters', () => {
  let client: MongoClient;
  let redis: Redis;
  let repo: MongoOfferRepository;

  const base: Omit<Offer, 'id'> = {
    name: 'Controle', segment: 'CONTROLE', monthlyPrice: 50, dataGb: 20, ddds: [], benefits: [], active: true, validUntil: null,
  };

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl!);
    const db = client.db(`catalog_test_${Date.now()}`);
    repo = new MongoOfferRepository(db);
    await repo.ensureIndexes();
    await repo.upsert({ ...base, id: 'o1', name: 'Controle Turbo', benefits: ['streaming de música'], ddds: ['82'] });
    await repo.upsert({ ...base, id: 'o2', segment: 'POS_PAGO', monthlyPrice: 120, ddds: ['11'] });
    await repo.upsert({ ...base, id: 'o3', segment: 'POS_PAGO', monthlyPrice: 90 });
    redis = new Redis(redisUrl!);
  });

  afterAll(async () => {
    await client?.db().dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  it('filters by region, full-text search and keyset pagination', async () => {
    expect((await repo.search({ ddd: '82', limit: 10 })).items.map((o) => o.id)).toEqual(['o1', 'o3']);
    expect((await repo.search({ text: 'música', limit: 10 })).items.map((o) => o.id)).toEqual(['o1']);
    const page = await repo.search({ limit: 2 });
    expect(page.nextCursor).toBe('o2');
  });

  it('aggregates cheapest offer per segment', async () => {
    expect(await repo.summaryBySegment('11')).toEqual([{ segment: 'POS_PAGO', offers: 2, cheapest: 90 }]);
  });

  it('redis cache sets, reads and invalidates by prefix', async () => {
    const cache = new RedisCache(redis);
    await cache.set('itest:a', '1', 30);
    await cache.set('itest:b', '2', 30);
    expect(await cache.get('itest:a')).toBe('1');
    await cache.invalidatePrefix('itest:');
    expect(await cache.get('itest:b')).toBeNull();
  });
});
