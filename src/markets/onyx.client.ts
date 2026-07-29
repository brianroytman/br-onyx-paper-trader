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

  /** Single market by symbol — used on the order path to price a fill. */
  async getMarket(symbol: string): Promise<OnyxMarket | null> {
    const body = await this.get<OnyxMarket | OnyxMarket[]>(
      `/markets/${encodeURIComponent(symbol)}`,
    );
    if (Array.isArray(body)) return body[0] ?? null;
    return body ?? null;
  }
}
