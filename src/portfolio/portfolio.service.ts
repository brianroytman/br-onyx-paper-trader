import { Injectable } from '@nestjs/common';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma.service';
import {
  averageEntryCents,
  marketValueCents,
  totalEquityCents,
  unrealizedPnlCents,
} from './portfolio.math';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markets: MarketsService,
  ) {}

  async forUser(userId: string) {
    // Independent reads, so run them together.
    const [user, positions, orders] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.position.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    // Valued against the current snapshot at request time — never precomputed,
    // so a valuation cannot drift from the live price.
    const snapshot = await this.markets.find({ status: 'all', limit: 200, offset: 0 });
    const priceById = new Map(
      snapshot.markets.map((m) => [m.id, m] as const),
    );

    const priced = await Promise.all(
      positions.map(async (p) => {
        let market = priceById.get(p.marketId) ?? null;
        if (!market) {
          market = await this.markets.findById(p.marketId).catch(() => null);
        }
        const currentPriceCents = market
          ? p.side === 'YES'
            ? market.yesPriceCents
            : market.noPriceCents
          : null;

        const held = { quantity: p.quantity, totalCostCents: p.totalCostCents };

        return {
          marketId: p.marketId,
          marketName: p.marketName,
          side: p.side,
          quantity: p.quantity,
          averageEntryCents: averageEntryCents(held),
          currentPriceCents,
          marketValueCents: marketValueCents(held, currentPriceCents),
          unrealizedPnlCents: unrealizedPnlCents(held, currentPriceCents),
        };
      }),
    );

    const positionsValueCents = priced.reduce((s, p) => s + p.marketValueCents, 0);

    return {
      cashCents: user.cashCents,
      positionsValueCents,
      unrealizedPnlCents: priced.reduce((s, p) => s + p.unrealizedPnlCents, 0),
      totalEquityCents: totalEquityCents(
        user.cashCents,
        priced.map((p) => p.marketValueCents),
      ),
      positions: priced,
      orders,
    };
  }
}
