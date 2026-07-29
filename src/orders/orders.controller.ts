import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { User } from '../generated/prisma/client';
import { OrdersService } from './orders.service';
import type { PlaceOrderInput } from './orders.service';

@Controller('orders')
@UseGuards(FirebaseAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Body carries marketId, side, and quantity — never a price. */
  @Post()
  place(@CurrentUser() user: User, @Body() body: PlaceOrderInput) {
    return this.orders.place(user.id, body);
  }
}
