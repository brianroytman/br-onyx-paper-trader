import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketsService } from './markets.service';

@Controller('markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('league') league?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.markets.find({
      q,
      status,
      league,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.markets.findById(id);
  }
}
