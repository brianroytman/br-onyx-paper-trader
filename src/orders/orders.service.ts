import { BadRequestException, Injectable } from '@nestjs/common';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma.service';
import {
  assertSufficientFunds,
  assertValidQuantity,
  assertValidSide,
  mergePosition,
  orderCostCents,
  OrderValidationError,
  selectPriceCents,
} from './order.math';

export interface PlaceOrderInput {
  marketId?: unknown;
  side?: unknown;
  quantity?: unknown;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markets: MarketsService,
  ) {}

  /**
   * Note the absence of a price parameter. The fill price is fetched
   * server-side at execution time, so a client cannot influence what it pays.
   */
  async place(userId: string, input: PlaceOrderInput) {
    try {
      const quantity = assertValidQuantity(input.quantity);
      const side = assertValidSide(input.side);
      const marketId = String(input.marketId ?? '');
      if (!marketId) throw new OrderValidationError('marketId is required');

      // Deliberately bypasses the browse cache — a fill must never be priced
      // from a stale snapshot.
      const market = await this.markets.getLivePrice(marketId);
      const fillPriceCents = selectPriceCents(market, side);
      const totalCents = orderCostCents(fillPriceCents, quantity);

      // Balance check, cash deduction, order insert, and position upsert all
      // commit together or not at all.
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        assertSufficientFunds(user.cashCents, totalCents);

        const updated = await tx.user.update({
          where: { id: userId },
          data: { cashCents: { decrement: totalCents } },
        });

        const order = await tx.order.create({
          data: {
            userId,
            marketId: market.id,
            marketSymbol: market.symbol,
            marketName: market.name,
            side,
            quantity,
            fillPriceCents,
            totalCents,
          },
        });

        const existing = await tx.position.findUnique({
          where: { userId_marketId_side: { userId, marketId: market.id, side } },
        });
        const merged = mergePosition(existing, quantity, totalCents);

        await tx.position.upsert({
          where: { userId_marketId_side: { userId, marketId: market.id, side } },
          create: {
            userId,
            marketId: market.id,
            marketSymbol: market.symbol,
            marketName: market.name,
            side,
            quantity: merged.quantity,
            totalCostCents: merged.totalCostCents,
          },
          update: {
            quantity: merged.quantity,
            totalCostCents: merged.totalCostCents,
          },
        });

        return { order, cashCents: updated.cashCents };
      });
    } catch (err) {
      if (err instanceof OrderValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  listForUser(userId: string, limit = 25) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
