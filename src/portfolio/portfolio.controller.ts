import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { User } from '../generated/prisma/client';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@UseGuards(FirebaseAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.portfolio.forUser(user.id);
  }
}
