import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OnyxMarket } from './market.types';

const BASE_URL = process.env.ONYX_BASE_URL ?? 'https://predictions.dev-onyxodds.com';
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/**
 * The only place that talks to Onyx. Read-only by design — this application
 * never submits an order upstream.
 */
@Injectable()
export class OnyxClient {
  private readonly logger = new Logger(OnyxClient.name);

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Onyx responded ${res.status} for ${path}`,
      );
    }
    return (await res.json()) as T;
  }

  /**
   * Onyx paginates with limit/offset and returns a bare array with no total,
   * so we page until a short page comes back.
   */
  async listMarkets(): Promise<OnyxMarket[]> {
    const all: OnyxMarket[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await this.get<OnyxMarket[]>(
        `/markets?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    this.logger.log(`Fetched ${all.length} markets from Onyx`);
    return all;
  }

  /**
   * Live quote for one market, used on the order path.
   *
   * `/markets/{symbol}` returns `yes_price: null` — only the list endpoint
   * populates it — so pricing a fill goes through the quote endpoint instead.
   * Its `bid_price` is the same figure the list reports as `yes_price`, which
   * keeps the fill consistent with what the user was shown.
   */
  async getQuote(symbol: string): Promise<number | null> {
    try {
      const quote = await this.get<{
        bid_price: number | null;
        ask_price: number | null;
        last_price: number | null;
      }>(`/markets/${encodeURIComponent(symbol)}/prices`);
      return quote.bid_price ?? quote.last_price ?? null;
    } catch (err) {
      this.logger.warn(`Quote lookup failed for ${symbol}: ${String(err)}`);
      return null;
    }
  }
}
