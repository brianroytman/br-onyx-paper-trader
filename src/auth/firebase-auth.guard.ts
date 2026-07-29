import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma.service';

// On Cloud Run this resolves credentials from the metadata server; locally it
// uses `gcloud auth application-default login`. No service-account key exists.
if (getApps().length === 0) {
  initializeApp();
}

const STARTING_BALANCE_CENTS = 100_000;

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Users are provisioned lazily on first authenticated request. There is no
    // separate registration endpoint to keep in sync with Firebase, and an
    // existing user is never reset to the starting balance.
    req.user = await this.prisma.user.upsert({
      where: { uid: decoded.uid },
      update: {},
      create: {
        uid: decoded.uid,
        email: decoded.email ?? '',
        cashCents: STARTING_BALANCE_CENTS,
      },
    });

    return true;
  }
}
