import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ExchangeApiResponse = {
  result?: string;
  base_code?: string;
  time_last_update_unix?: number;
  time_next_update_unix?: number;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
};

export type CurrencyRatesResponse = {
  base: string;
  fetchedAt: string;
  nextUpdateAt: string | null;
  rates: Record<string, number>;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private cache: { data: CurrencyRatesResponse; storedAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('EXCHANGE_RATE_API_KEY')?.trim());
  }

  getBaseCurrency(): string {
    return (
      this.config.get<string>('EXCHANGE_RATE_BASE_CURRENCY')?.trim().toUpperCase() ||
      'USD'
    );
  }

  async getLatestRates(force = false): Promise<CurrencyRatesResponse> {
    if (!force && this.cache && Date.now() - this.cache.storedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const key = this.config.get<string>('EXCHANGE_RATE_API_KEY')?.trim();
    if (!key) {
      throw new HttpException(
        'EXCHANGE_RATE_API_KEY no está configurado en el backend.',
        503,
      );
    }

    const baseUrl =
      this.config.get<string>('EXCHANGE_RATE_BASE_URL')?.trim() ||
      'https://v6.exchangerate-api.com/v6';
    const base = this.getBaseCurrency();
    const url = `${baseUrl}/${key}/latest/${base}`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch (error) {
      this.logger.warn(
        `ExchangeRate API: error de red (${error instanceof Error ? error.message : String(error)})`,
      );
      throw new HttpException('No se pudo contactar el servicio de tasas.', 502);
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`ExchangeRate ${res.status}: ${text.slice(0, 400)}`);
      throw new HttpException('El proveedor de tasas devolvió un error.', 502);
    }

    let json: ExchangeApiResponse;
    try {
      json = JSON.parse(text) as ExchangeApiResponse;
    } catch {
      this.logger.warn('ExchangeRate: respuesta no es JSON válido.');
      throw new HttpException('Respuesta inválida del proveedor de tasas.', 502);
    }

    if (json.result !== 'success' || !json.conversion_rates) {
      this.logger.warn(`ExchangeRate respuesta inesperada: ${json['error-type'] ?? 'desconocido'}`);
      throw new HttpException('El proveedor de tasas devolvió un error.', 502);
    }

    const data: CurrencyRatesResponse = {
      base: (json.base_code ?? base).toUpperCase(),
      fetchedAt: json.time_last_update_unix
        ? new Date(json.time_last_update_unix * 1000).toISOString()
        : new Date().toISOString(),
      nextUpdateAt: json.time_next_update_unix
        ? new Date(json.time_next_update_unix * 1000).toISOString()
        : null,
      rates: json.conversion_rates,
    };

    this.cache = { data, storedAt: Date.now() };
    return data;
  }
}
