import type { Offer, OfferQuery } from '../domain/offer.js';
import type { Cache, OfferRepository } from './ports.js';

const PREFIX = 'offers:';

/**
 * Cache-aside decorator over any OfferRepository. The catalog is read-heavy (every app
 * screen and store terminal) and written a few times a day, so reads are cached and any
 * write invalidates the whole namespace.
 */
export class CachedOfferRepository implements OfferRepository {
  constructor(
    private readonly inner: OfferRepository,
    private readonly cache: Cache,
    private readonly ttlSeconds = 300,
  ) {}

  private async cached<T>(key: string, load: () => Promise<T>, revive?: (v: T) => T): Promise<T> {
    const hit = await this.cache.get(PREFIX + key);
    if (hit !== null) {
      const parsed = JSON.parse(hit) as T;
      return revive ? revive(parsed) : parsed;
    }
    const value = await load();
    await this.cache.set(PREFIX + key, JSON.stringify(value), this.ttlSeconds);
    return value;
  }

  search(query: OfferQuery) {
    return this.cached(`search:${JSON.stringify(query)}`, () => this.inner.search(query), (page) => ({
      ...page,
      items: page.items.map(reviveDates),
    }));
  }

  findById(id: string) {
    return this.cached(`id:${id}`, () => this.inner.findById(id), (o) => (o ? reviveDates(o) : o));
  }

  summaryBySegment(ddd: string) {
    return this.cached(`summary:${ddd}`, () => this.inner.summaryBySegment(ddd));
  }

  async upsert(offer: Offer) {
    await this.inner.upsert(offer);
    await this.cache.invalidatePrefix(PREFIX);
  }
}

function reviveDates(o: Offer): Offer {
  return { ...o, validUntil: o.validUntil ? new Date(o.validUntil) : null };
}
