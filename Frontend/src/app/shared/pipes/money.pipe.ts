import { inject, Pipe, PipeTransform } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

@Pipe({
  name: 'money',
  standalone: true,
  pure: false,
})
export class MoneyPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(
    amount: number | null | undefined,
    fromCurrency?: string | null,
    toCurrency?: string | null,
  ): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return '—';
    }
    return this.currency.format(
      amount,
      fromCurrency ?? this.currency.baseCurrency,
      toCurrency ?? undefined,
    );
  }
}
