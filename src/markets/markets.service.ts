import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { noPriceFromYes, toCents, toMarket } from './market.mapper';
import { Market } from './market.types';
import { OnyxClient } from './onyx.client';

const CACHE_TTL_MS = 5_000;

export interface MarketQuery {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface MarketPage {
  markets: Market[];
  total: number;
  fetchedAt: string;
}

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly logger = new Logger(MarketsService.name);
  private cache: { markets: Market[]; at: number } | null = null;
  private inFlight: Promise<Market[]> | null = null;

  constructor(private readonly onyx: OnyxClient) {}

  /**
   * Warm the catalog at startup so the first visitor doesn't pay for paging
   * through ~5,000 markets. Deliberately not awaited — a slow or failing Onyx
   * must not prevent the app from booting.
   */
  onModuleInit() {
    void this.refresh().catch((err) =>
      this.logger.warn(`Initial market fetch failed: ${String(err)}`),
    );
  }

  /** One upstream fetch at a time, shared by every concurrent caller. */
  private refresh(): Promise<Market[]> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.onyx
      .listMarkets()
      .then((raw) => {
        const markets = raw.map(toMarket);
        this.cache = { markets, at: Date.now() };
        return markets;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  /**
   * Stale-while-revalidate. Only the very first call ever blocks; after that a
   * request always gets an immediate answer and any expired snapshot is
   * refreshed in the background. A failed refresh leaves the old data in place.
   */
  private async snapshot(): Promise<Market[]> {
    if (!this.cache) return this.refresh();

    if (Date.now() - this.cache.at >= CACHE_TTL_MS) {
      void this.refresh().catch((err) =>
        this.logger.warn(`Background refresh failed: ${String(err)}`),
      );
    }

    return this.cache.markets;
  }

  /** Filtering happens server-side so the client receives a small page. */
  async find(query: MarketQuery): Promise<MarketPage> {
    const all = await this.snapshot();
    const q = query.q?.trim().toLowerCase();
    const status = query.status?.trim().toLowerCase();

    const filtered = all.filter((m) => {
      if (status && status !== 'all' && m.status !== status) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.symbol.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(Math.max(1, query.limit ?? 50), 200);

    return {
      markets: filtered.slice(offset, offset + limit),
      total: filtered.length,
      fetchedAt: new Date(this.cache?.at ?? Date.now()).toISOString(),
    };
  }

  async findById(id: string): Promise<Market> {
    const all = await this.snapshot();
    const market = all.find((m) => m.id === id);
    if (!market) throw new NotFoundException(`Market ${id} not found`);
    return market;
  }

  /**
   * Bypasses the cache. Used only on the order path — a fill must never be
   * priced from a stale snapshot.
   */
  async getLivePrice(id: string): Promise<Market> {
    const market = await this.findById(id);
    const yesPrice = await this.onyx.getQuote(market.symbol);
    const yesPriceCents = toCents(yesPrice);

    // If the quote endpoint has nothing for this market, fall back to the
    // snapshot rather than rejecting an order on a market we just quoted.
    if (yesPriceCents === null) return market;

    return {
      ...market,
      yesPriceCents,
      noPriceCents: noPriceFromYes(yesPriceCents),
      tradable: market.status === 'open',
    };
  }
}
