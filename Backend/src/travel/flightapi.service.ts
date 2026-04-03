import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Códigos ISO 3166-1 alpha-2 usados como “ciudad” → aeropuerto principal para la ruta (IATA 3 letras).
 * Si no hay entrada, se envía el código tal cual (2 letras) a la API.
 */
const ISO2_TO_MAIN_AIRPORT_IATA: Record<string, string> = {
  MX: 'MEX',
  ES: 'MAD',
  AR: 'EZE',
  CO: 'BOG',
  BR: 'GRU',
  CL: 'SCL',
  PE: 'LIM',
  FR: 'CDG',
  DE: 'FRA',
  IT: 'FCO',
  GB: 'LHR',
  PT: 'LIS',
  NL: 'AMS',
  BE: 'BRU',
  CH: 'ZRH',
  AT: 'VIE',
  PL: 'WAW',
  JP: 'NRT',
  KR: 'ICN',
  CN: 'PEK',
  AU: 'SYD',
  CA: 'YYZ',
};

/**
 * FlightAPI (flightapi.io) — precios de vuelos ida.
 * @see https://docs.flightapi.io/flight-price-api/oneway-trip-api
 */
@Injectable()
export class FlightApiService {
  private readonly logger = new Logger(FlightApiService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('FLIGHTAPI_BASE_URL')?.trim() || 'https://api.flightapi.io';
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('FLIGHTAPI_API_KEY')?.trim());
  }

  private apiKey(): string | null {
    return this.config.get<string>('FLIGHTAPI_API_KEY')?.trim() || null;
  }

  /**
   * Documentación: path `onewaytrip/{key}/{dep}/{arr}/{date}/1/0/0/Economy/{currency}` o con `/region` al final.
   */
  async searchOneway(params: {
    departureAirport: string;
    arrivalAirport: string;
    departureDate: string;
    currency: string;
  }): Promise<Record<string, unknown> | null> {
    const key = this.apiKey();
    if (!key) {
      return null;
    }

    const region = this.config.get<string>('FLIGHTAPI_REGION')?.trim() || 'US';
    const dep = this.toPathAirportCode(params.departureAirport);
    const arr = this.toPathAirportCode(params.arrivalAirport);
    if (!dep || !arr) {
      return null;
    }

    const base = [
      key,
      dep,
      arr,
      params.departureDate,
      '1',
      '0',
      '0',
      'Economy',
      params.currency.toUpperCase(),
    ];

    let parsed = await this.fetchOnewayPath(base);
    const itin = parsed && Array.isArray(parsed['itineraries']) ? (parsed['itineraries'] as unknown[]).length : 0;
    if (!itin) {
      parsed = await this.fetchOnewayPath([...base, region]);
    }
    return parsed;
  }

  private async fetchOnewayPath(segments: string[]): Promise<Record<string, unknown> | null> {
    const path = segments.map((s) => encodeURIComponent(s)).join('/');
    const url = `${this.baseUrl}/onewaytrip/${path}`;

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      this.logger.warn(`FlightAPI ${res.status}: ${text.slice(0, 400)}`);
      return null;
    }

    try {
      const json = JSON.parse(text) as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        const o = json as Record<string, unknown>;
        if (Array.isArray(o['itineraries'])) {
          return o;
        }
        const data = o['data'];
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return data as Record<string, unknown>;
        }
      }
      return null;
    } catch {
      this.logger.warn('FlightAPI: JSON inválido');
      return null;
    }
  }

  /**
   * Normaliza a segmento de URL: 3 letras IATA si es posible; códigos ISO2 p. ej. MX → MEX.
   */
  private toPathAirportCode(raw: string): string | null {
    const c = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
    if (c.length < 2) {
      return null;
    }
    if (c.length >= 3) {
      return c.slice(0, 3);
    }
    return ISO2_TO_MAIN_AIRPORT_IATA[c] ?? c;
  }
}
