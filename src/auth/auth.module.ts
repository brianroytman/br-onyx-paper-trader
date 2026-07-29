import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthController } from './auth.controller';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [PrismaService, FirebaseAuthGuard],
  exports: [PrismaService, FirebaseAuthGuard],
})
export class AuthModule {}
