import { Controller, Get, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  @Get('rates')
  async getRates(@Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true';
    return this.currency.getLatestRates(force);
  }
}
