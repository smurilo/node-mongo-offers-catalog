import type { Offer, OfferQuery, Page, Segment } from '../../domain/offer.js';
import type { Cache, OfferRepository } from '../../application/ports.js';

export class InMemoryOfferRepository implements OfferRepository {
  readonly calls = { search: 0 };
  private readonly offers = new Map<string, Offer>();

  async search(q: OfferQuery): Promise<Page<Offer>> {
    this.calls.search++;
    const all = [...this.offers.values()]
      .filter((o) => o.active)
      .filter((o) => !q.ddd || o.ddds.length === 0 || o.ddds.includes(q.ddd))
      .filter((o) => !q.segment || o.segment === q.segment)
      .filter((o) => q.maxPrice === undefined || o.monthlyPrice <= q.maxPrice)
      .filter((o) => !q.text || `${o.name} ${o.benefits.join(' ')}`.toLowerCase().includes(q.text.toLowerCase()))
      .filter((o) => !q.after || o.id > q.after)
      .sort((a, b) => a.id.localeCompare(b.id));
    const items = all.slice(0, q.limit);
    return { items, nextCursor: all.length > q.limit ? (items.at(-1)?.id ?? null) : null };
  }

  async findById(id: string) {
    return this.offers.get(id) ?? null;
  }

  async upsert(offer: Offer) {
    this.offers.set(offer.id, offer);
  }

  async summaryBySegment(ddd: string) {
    const groups = new Map<Segment, { segment: Segment; offers: number; cheapest: number }>();
    for (const o of this.offers.values()) {
      if (!o.active || (o.ddds.length && !o.ddds.includes(ddd))) continue;
      const g = groups.get(o.segment) ?? { segment: o.segment, offers: 0, cheapest: Infinity };
      g.offers++;
      g.cheapest = Math.min(g.cheapest, o.monthlyPrice);
      groups.set(o.segment, g);
    }
    return [...groups.values()].sort((a, b) => a.cheapest - b.cheapest);
  }
}

export class InMemoryCache implements Cache {
  private readonly store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }

  async invalidatePrefix(prefix: string) {
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }
}
