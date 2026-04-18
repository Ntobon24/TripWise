import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class OpenTripMapService {
  private readonly logger = new Logger(OpenTripMapService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim());
  }

  
  async searchPlacesAroundRadius(params: {
    lat: number;
    lng: number;
    radiusMeters?: number;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    const key = this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim();
    if (!key) {
      return [];
    }

    const q = new URLSearchParams({
      radius: String(params.radiusMeters ?? 8000),
      lon: String(params.lng),
      lat: String(params.lat),
      rate: '3',
      kinds: 'interesting_places,cultural,historic,architecture,museums,natural',
      limit: String(Math.min(params.limit ?? 25, 50)),
      apikey: key,
    });

    const res = await fetch(`https://api.opentripmap.com/0.1/en/places/radius?${q}`);

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`OpenTripMap radius error: ${res.status} ${text}`);
      return [];
    }

    const json = (await res.json()) as { features?: Record<string, unknown>[] };
    return json.features ?? [];
  }
}
