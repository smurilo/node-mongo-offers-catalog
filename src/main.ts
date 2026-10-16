import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { createApp } from './adapters/http/app.js';
import { MongoOfferRepository } from './adapters/mongo/mongo-offer-repository.js';
import { RedisCache } from './adapters/redis/redis-cache.js';
import { CachedOfferRepository } from './application/cached-offer-repository.js';
import { CatalogService } from './application/catalog-service.js';

const mongo = await MongoClient.connect(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const repository = new MongoOfferRepository(mongo.db('catalog'));
await repository.ensureIndexes();

const catalog = new CatalogService(new CachedOfferRepository(repository, new RedisCache(redis)));
const secret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
const port = Number(process.env.PORT ?? 3000);

createApp(catalog, secret).listen(port, () => console.log(`catalog API on :${port}`));
