import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, uptime: process.uptime() };
  }
}
