import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  Input,
  signal,
} from '@angular/core';
import { CurrencyService, SupportedCurrency } from '../../../core/services/currency.service';

@Component({
  selector: 'app-currency-selector',
  standalone: true,
  templateUrl: './currency-selector.html',
  styleUrl: './currency-selector.scss',
})
export class CurrencySelectorComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly currency = inject(CurrencyService);

  @Input() compact = false;
  @Input() ariaLabel = 'Cambiar moneda de visualización';

  protected readonly open = signal(false);
  protected readonly supported = this.currency.supported;

  protected readonly active = computed<SupportedCurrency>(() => {
    const code = this.currency.displayCurrency();
    return (
      this.currency.currencyMeta(code) ?? {
        code,
        name: code,
        flag: '',
        symbol: code,
        decimals: 2,
      }
    );
  });

  protected readonly loading = this.currency.loading;
  protected readonly errorMsg = this.currency.error;
  protected readonly lastUpdated = this.currency.lastUpdated;

  protected readonly formattedUpdate = computed(() => {
    const d = this.lastUpdated();
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return d.toISOString();
    }
  });

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected select(code: string): void {
    this.currency.setDisplayCurrency(code);
    this.close();
  }

  protected retry(event: Event): void {
    event.stopPropagation();
    void this.currency.ensureRatesLoaded(true);
  }

  protected isActive(code: string): boolean {
    return this.active().code === code;
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }
}
