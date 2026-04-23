import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SupportedCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  decimals: number;
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'Dólar estadounidense', flag: '', symbol: 'US$', decimals: 2 },
  { code: 'EUR', name: 'Euro', flag: '', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'Libra esterlina', flag: '', symbol: '£', decimals: 2 },
  { code: 'COP', name: 'Peso colombiano', flag: '', symbol: 'COL$', decimals: 0 },
  { code: 'MXN', name: 'Peso mexicano', flag: '', symbol: 'MX$', decimals: 2 },
  { code: 'ARS', name: 'Peso argentino', flag: '', symbol: 'AR$', decimals: 0 },
  { code: 'CLP', name: 'Peso chileno', flag: '', symbol: 'CL$', decimals: 0 },
  { code: 'PEN', name: 'Sol peruano', flag: '', symbol: 'S/.', decimals: 2 },
  { code: 'BRL', name: 'Real brasileño', flag: '', symbol: 'R$', decimals: 2 },
  { code: 'CAD', name: 'Dólar canadiense', flag: '', symbol: 'C$', decimals: 2 },
  { code: 'AUD', name: 'Dólar australiano', flag: '', symbol: 'A$', decimals: 2 },
  { code: 'JPY', name: 'Yen japonés', flag: '', symbol: '¥', decimals: 0 },
  { code: 'CHF', name: 'Franco suizo', flag: '', symbol: 'CHF', decimals: 2 },
  { code: 'CNY', name: 'Yuan chino', flag: '', symbol: 'CN¥', decimals: 2 },
];

const CURRENCY_INDEX = new Map<string, SupportedCurrency>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c]),
);

const RATES_STORAGE_KEY = 'tripwise.rates';
const DISPLAY_STORAGE_KEY = 'tripwise.displayCurrency';
const DEFAULT_BASE_CURRENCY = 'USD';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CachedRates = {
  base: string;
  fetchedAt: number;
  rates: Record<string, number>;
};

type BackendRatesResponse = {
  base: string;
  fetchedAt: string;
  nextUpdateAt: string | null;
  rates: Record<string, number>;
};

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);

  readonly baseCurrency = DEFAULT_BASE_CURRENCY;
  readonly supported = SUPPORTED_CURRENCIES;

  readonly displayCurrency = signal<string>(this.loadDisplayCurrency());
  readonly rates = signal<Record<string, number>>({ [DEFAULT_BASE_CURRENCY]: 1 });
  readonly lastUpdated = signal<Date | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.hydrateFromCache();
  }

  async ensureRatesLoaded(force = false): Promise<void> {
    if (this.loading()) {
      return;
    }
    if (!force && this.isCacheFresh()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${environment.apiBaseUrl}/currency/rates${force ? '?refresh=1' : ''}`;
      const res = await firstValueFrom(this.http.get<BackendRatesResponse>(url));
      if (!res?.rates || typeof res.rates !== 'object') {
        throw new Error('Respuesta inválida del servidor de tasas.');
      }
      const fetchedAt = res.fetchedAt ? Date.parse(res.fetchedAt) : Date.now();
      const payload: CachedRates = {
        base: (res.base || DEFAULT_BASE_CURRENCY).toUpperCase(),
        fetchedAt: Number.isNaN(fetchedAt) ? Date.now() : fetchedAt,
        rates: res.rates,
      };
      this.persistRates(payload);
      this.rates.set(res.rates);
      this.lastUpdated.set(new Date(payload.fetchedAt));
    } catch (e) {
      const msg =
        (e as { error?: { message?: string }; message?: string })?.error?.message ??
        (e as { message?: string })?.message ??
        'No se pudieron actualizar las tasas.';
      this.error.set(msg);
      if (Object.keys(this.rates()).length <= 1) {
        this.rates.set({ [DEFAULT_BASE_CURRENCY]: 1 });
      }
    } finally {
      this.loading.set(false);
    }
  }

  setDisplayCurrency(code: string): void {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized || !CURRENCY_INDEX.has(normalized)) {
      return;
    }
    this.displayCurrency.set(normalized);
    try {
      localStorage.setItem(DISPLAY_STORAGE_KEY, normalized);
    } catch {

    }
  }

  convert(
    amount: number | null | undefined,
    fromCurrency: string | null | undefined,
    toCurrency?: string,
  ): number | null {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return null;
    }
    const from = (fromCurrency || this.baseCurrency).trim().toUpperCase();
    const to = (toCurrency || this.displayCurrency()).trim().toUpperCase();
    if (from === to) {
      return amount;
    }
    const rates = this.rates();
    const base = this.baseCurrency;

    const rateFrom = from === base ? 1 : rates[from];
    const rateTo = to === base ? 1 : rates[to];
    if (!rateFrom || !rateTo) {
      return null;
    }
    const amountInBase = amount / rateFrom;
    return amountInBase * rateTo;
  }

  format(
    amount: number | null | undefined,
    fromCurrency: string | null | undefined,
    toCurrency?: string,
  ): string {
    const target = (toCurrency || this.displayCurrency()).trim().toUpperCase();
    const meta = CURRENCY_INDEX.get(target);
    const converted = this.convert(amount, fromCurrency, target);
    if (converted === null) {
      return '—';
    }
    const decimals = meta?.decimals ?? 2;
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: target,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(converted);
    } catch {
      const prefix = meta?.symbol ?? target;
      return `${prefix} ${converted.toFixed(decimals)}`;
    }
  }

  currencyMeta(code: string | null | undefined): SupportedCurrency | null {
    if (!code) {
      return null;
    }
    return CURRENCY_INDEX.get(code.trim().toUpperCase()) ?? null;
  }

  private isCacheFresh(): boolean {
    const updated = this.lastUpdated();
    if (!updated) {
      return false;
    }
    return Date.now() - updated.getTime() < CACHE_TTL_MS;
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStorage.getItem(RATES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CachedRates;
      if (
        parsed &&
        parsed.rates &&
        typeof parsed.fetchedAt === 'number' &&
        parsed.base === DEFAULT_BASE_CURRENCY
      ) {
        this.rates.set(parsed.rates);
        this.lastUpdated.set(new Date(parsed.fetchedAt));
      }
    } catch {

    }
  }

  private persistRates(payload: CachedRates): void {
    try {
      localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(payload));
    } catch {

    }
  }

  private loadDisplayCurrency(): string {
    try {
      const stored = localStorage.getItem(DISPLAY_STORAGE_KEY)?.trim().toUpperCase();
      if (stored && CURRENCY_INDEX.has(stored)) {
        return stored;
      }
    } catch {

    }
    return DEFAULT_BASE_CURRENCY;
  }
}
