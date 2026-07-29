import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { CurrentUser } from './current-user.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  @Get()
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      cashCents: user.cashCents,
    };
  }
}
