import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../generated/prisma/client';

/** Reads the user that FirebaseAuthGuard resolved for this request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest().user,
);
