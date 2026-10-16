export type Segment = 'PRE_PAGO' | 'CONTROLE' | 'POS_PAGO' | 'FIBRA';

export interface Offer {
  id: string;
  name: string;
  segment: Segment;
  monthlyPrice: number;
  dataGb: number;
  /** two-digit Brazilian area codes where the offer is sold; empty = nationwide */
  ddds: string[];
  benefits: string[];
  active: boolean;
  validUntil: Date | null;
}

export interface OfferQuery {
  ddd?: string;
  segment?: Segment;
  maxPrice?: number;
  text?: string;
  limit: number;
  /** opaque cursor (id of the last item of the previous page) */
  after?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function isSellable(offer: Offer, ddd: string, now: Date): boolean {
  if (!offer.active) return false;
  if (offer.validUntil && offer.validUntil < now) return false;
  return offer.ddds.length === 0 || offer.ddds.includes(ddd);
}

/** Price per GB is what sales teams compare; unlimited-data fibre plans have no per-GB price. */
export function pricePerGb(offer: Offer): number | null {
  return offer.dataGb > 0 ? Math.round((offer.monthlyPrice / offer.dataGb) * 100) / 100 : null;
}
