import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeoDbService {
  private readonly logger = new Logger(GeoDbService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('GEODB_RAPIDAPI_KEY')?.trim());
  }

  /** GeoDB Cities API host; tolerates common .env typo `.rapidapi.coms` → `.rapidapi.com`. */
  private getHost(): string {
    let host =
      this.config.get<string>('GEODB_RAPIDAPI_HOST')?.trim() || 'wft-geo-db.p.rapidapi.com';
    if (/\.p\.rapidapi\.coms$/i.test(host)) {
      host = host.replace(/\.coms$/i, '.com');
    }
    return host;
  }

  async searchCities(namePrefix: string, limit = 10): Promise<unknown[]> {
    const key = this.config.get<string>('GEODB_RAPIDAPI_KEY');
    if (!key) {
      return [];
    }

    const host = this.getHost();
    const params = new URLSearchParams({
      namePrefix: namePrefix.trim(),
      limit: String(Math.min(limit, 10)),
      offset: '0',
      sort: '-population',
    });

    const res = await fetch(`https://${host}/v1/geo/cities?${params}`, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`GeoDB error: ${res.status} ${text}`);
      return [];
    }

    const json = (await res.json()) as { data?: unknown[] };
    return json.data ?? [];
  }

  async getFirstCityCoords(
    namePrefix: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const rows = await this.searchCities(namePrefix, 1);
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) {
      return null;
    }
    const lat = r['latitude'];
    const lng = r['longitude'];
    const la =
      typeof lat === 'number' ? lat : typeof lat === 'string' ? parseFloat(lat) : Number.NaN;
    const lo =
      typeof lng === 'number' ? lng : typeof lng === 'string' ? parseFloat(lng) : Number.NaN;
    if (Number.isNaN(la) || Number.isNaN(lo)) {
      return null;
    }
    return { latitude: la, longitude: lo };
  }
}
