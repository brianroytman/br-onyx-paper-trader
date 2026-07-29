import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { OnyxClient } from './onyx.client';

@Module({
  controllers: [MarketsController],
  providers: [OnyxClient, MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
