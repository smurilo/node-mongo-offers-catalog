import type { Collection, Db, Filter } from 'mongodb';
import type { Offer, OfferQuery, Page, Segment } from '../../domain/offer.js';
import type { OfferRepository } from '../../application/ports.js';

type OfferDoc = Omit<Offer, 'id'> & { _id: string };

const toDomain = ({ _id, ...rest }: OfferDoc): Offer => ({ id: _id, ...rest });

export class MongoOfferRepository implements OfferRepository {
  private readonly col: Collection<OfferDoc>;

  constructor(db: Db) {
    this.col = db.collection<OfferDoc>('offers');
  }

  /** Indexes match the access patterns: filter by region/segment sorted by price, plus full-text search. */
  async ensureIndexes() {
    await this.col.createIndexes([
      { key: { active: 1, ddds: 1, segment: 1, monthlyPrice: 1 } },
      { key: { name: 'text', benefits: 'text' }, default_language: 'portuguese', name: 'offer_text' },
    ]);
  }

  async search(q: OfferQuery): Promise<Page<Offer>> {
    const filter: Filter<OfferDoc> = { active: true };
    if (q.ddd) filter.$or = [{ ddds: q.ddd }, { ddds: { $size: 0 } }];
    if (q.segment) filter.segment = q.segment;
    if (q.maxPrice !== undefined) filter.monthlyPrice = { $lte: q.maxPrice };
    if (q.text) filter.$text = { $search: q.text };
    // Keyset pagination: stable and O(log n) regardless of page depth, unlike skip/offset.
    if (q.after) filter._id = { $gt: q.after };

    const docs = await this.col.find(filter).sort({ _id: 1 }).limit(q.limit + 1).toArray();
    const hasMore = docs.length > q.limit;
    const items = docs.slice(0, q.limit).map(toDomain);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async findById(id: string) {
    const doc = await this.col.findOne({ _id: id });
    return doc ? toDomain(doc) : null;
  }

  async upsert({ id, ...rest }: Offer) {
    await this.col.replaceOne({ _id: id }, rest, { upsert: true });
  }

  async summaryBySegment(ddd: string) {
    return this.col
      .aggregate<{ segment: Segment; offers: number; cheapest: number }>([
        { $match: { active: true, $or: [{ ddds: ddd }, { ddds: { $size: 0 } }] } },
        { $group: { _id: '$segment', offers: { $sum: 1 }, cheapest: { $min: '$monthlyPrice' } } },
        { $project: { _id: 0, segment: '$_id', offers: 1, cheapest: 1 } },
        { $sort: { cheapest: 1 } },
      ])
      .toArray();
  }
}
