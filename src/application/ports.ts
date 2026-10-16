import type { Offer, OfferQuery, Page, Segment } from '../domain/offer.js';

export interface OfferRepository {
  search(query: OfferQuery): Promise<Page<Offer>>;
  findById(id: string): Promise<Offer | null>;
  upsert(offer: Offer): Promise<void>;
  summaryBySegment(ddd: string): Promise<{ segment: Segment; offers: number; cheapest: number }[]>;
}

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}
