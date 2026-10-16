import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/adapters/http/app.js';
import { InMemoryCache, InMemoryOfferRepository } from '../src/adapters/memory/memory-adapters.js';
import { CachedOfferRepository } from '../src/application/cached-offer-repository.js';
import { CatalogService } from '../src/application/catalog-service.js';
import type { Offer } from '../src/domain/offer.js';

const SECRET = 'test-secret';
const admin = `Bearer ${jwt.sign({ roles: ['CATALOG_ADMIN'] }, SECRET)}`;
const seller = `Bearer ${jwt.sign({ roles: ['SELLER'] }, SECRET)}`;

const offer = (o: Partial<Offer> & Pick<Offer, 'id'>): Offer => ({
  name: `Plano ${o.id}`, segment: 'CONTROLE', monthlyPrice: 50, dataGb: 20, ddds: [], benefits: [],
  active: true, validUntil: null, ...o,
});

let repo: InMemoryOfferRepository;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  repo = new InMemoryOfferRepository();
  const now = () => new Date('2026-03-01T00:00:00Z');
  app = createApp(new CatalogService(new CachedOfferRepository(repo, new InMemoryCache()), now), SECRET);
  await repo.upsert(offer({ id: 'a-controle-25', monthlyPrice: 49.9, dataGb: 25, benefits: ['WhatsApp ilimitado'] }));
  await repo.upsert(offer({ id: 'b-pos-100', segment: 'POS_PAGO', monthlyPrice: 149.9, dataGb: 100, ddds: ['82', '81'] }));
  await repo.upsert(offer({ id: 'c-pos-sp', segment: 'POS_PAGO', monthlyPrice: 99.9, dataGb: 60, ddds: ['11'] }));
  await repo.upsert(offer({ id: 'd-expirada', monthlyPrice: 9.9, validUntil: new Date('2026-01-01') }));
  await repo.upsert(offer({ id: 'e-fibra', segment: 'FIBRA', monthlyPrice: 99.9, dataGb: 0 }));
});

describe('catalog search', () => {
  it('returns only offers sellable in the customer DDD, with price per GB', async () => {
    const res = await request(app).get('/offers').query({ ddd: '82' });
    expect(res.body.items.map((o: Offer) => o.id)).toEqual(['a-controle-25', 'b-pos-100', 'e-fibra']);
    expect(res.body.items[0].pricePerGb).toBe(2);
    expect(res.body.items[2].pricePerGb).toBeNull();
  });

  it('paginates with an opaque cursor', async () => {
    const first = await request(app).get('/offers').query({ limit: 2 });
    expect(first.body.nextCursor).toBe('b-pos-100');
    const second = await request(app).get('/offers').query({ limit: 2, after: first.body.nextCursor });
    expect(second.body.items[0].id).toBe('c-pos-sp');
  });

  it('validates query parameters', async () => {
    expect((await request(app).get('/offers').query({ ddd: '820' })).status).toBe(400);
    expect((await request(app).get('/offers').query({ limit: 500 })).status).toBe(400);
  });

  it('serves repeated searches from cache and invalidates on publish', async () => {
    await request(app).get('/offers').query({ segment: 'POS_PAGO' });
    await request(app).get('/offers').query({ segment: 'POS_PAGO' });
    expect(repo.calls.search).toBe(1);

    await request(app).put('/offers/f-novo').set('authorization', admin)
      .send({ name: 'Pós Família', segment: 'POS_PAGO', monthlyPrice: 199.9, dataGb: 200 }).expect(204);

    const after = await request(app).get('/offers').query({ segment: 'POS_PAGO' });
    expect(repo.calls.search).toBe(2);
    expect(after.body.items.map((o: Offer) => o.id)).toContain('f-novo');
  });
});

describe('comparison and summary', () => {
  it('ranks compared offers by price per GB', async () => {
    const res = await request(app).get('/offers/compare').query({ ids: 'b-pos-100,a-controle-25,c-pos-sp,missing' });
    expect(res.body.map((o: { id: string }) => o.id)).toEqual(['b-pos-100', 'c-pos-sp', 'a-controle-25']);
  });

  it('summarises segments available in a region', async () => {
    const res = await request(app).get('/regions/11/summary');
    expect(res.body[0]).toEqual({ segment: 'CONTROLE', offers: 2, cheapest: 9.9 });
  });
});

describe('back-office security', () => {
  it('requires a token with CATALOG_ADMIN role to publish', async () => {
    const body = { name: 'X', segment: 'FIBRA', monthlyPrice: 1, dataGb: 0 };
    expect((await request(app).put('/offers/x1').send(body)).status).toBe(401);
    expect((await request(app).put('/offers/x1').set('authorization', seller).send(body)).status).toBe(403);
    expect((await request(app).put('/offers/x1').set('authorization', 'Bearer forged')).status).toBe(401);
  });
});
