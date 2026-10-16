import { isSellable, type Offer, type OfferQuery, pricePerGb } from '../domain/offer.js';
import type { OfferRepository } from './ports.js';

export class CatalogService {
  constructor(
    private readonly offers: OfferRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async search(query: OfferQuery) {
    const page = await this.offers.search(query);
    const now = this.now();
    return {
      ...page,
      items: page.items
        .filter((o) => !query.ddd || isSellable(o, query.ddd, now))
        .map((o) => ({ ...o, pricePerGb: pricePerGb(o) })),
    };
  }

  async compare(ids: string[]) {
    const found = (await Promise.all(ids.map((id) => this.offers.findById(id)))).filter((o): o is Offer => o !== null);
    return found
      .map((o) => ({ id: o.id, name: o.name, monthlyPrice: o.monthlyPrice, dataGb: o.dataGb, pricePerGb: pricePerGb(o) }))
      .sort((a, b) => (a.pricePerGb ?? Infinity) - (b.pricePerGb ?? Infinity));
  }

  summary(ddd: string) {
    return this.offers.summaryBySegment(ddd);
  }

  publish(offer: Offer) {
    return this.offers.upsert(offer);
  }
}
