import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OtmPlaceDetails = {
  xid: string;
  name: string | null;
  descriptionText: string | null;
  imageUrl: string | null;
  otmUrl: string | null;
  rate: number | null;
};

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

  /** Detalle por xid (OpenTripMap): descripción vía Wikipedia / info.descr. */
  async getPlaceDetails(xid: string, lang = 'es'): Promise<OtmPlaceDetails | null> {
    const key = this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim();
    if (!key) {
      return null;
    }

    const enc = encodeURIComponent(xid);
    const url = `https://api.opentripmap.com/0.1/${lang}/places/xid/${enc}?apikey=${key}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`OpenTripMap xid error: ${res.status} ${xid} ${text.slice(0, 120)}`);
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data['error']) {
      return null;
    }

    const name = (data['name'] as string | undefined) ?? null;
    const info = data['info'] as { descr?: string } | undefined;
    const wiki = data['wikipedia_extracts'] as { html?: string } | undefined;
    const preview = data['preview'] as { source?: string } | undefined;
    const otm = (data['otm'] as string | undefined) ?? null;
    const rateRaw = data['rate'];
    const rate =
      typeof rateRaw === 'number'
        ? rateRaw
        : typeof rateRaw === 'string'
          ? parseFloat(rateRaw)
          : null;

    let descriptionText: string | null = null;
    if (wiki?.html) {
      descriptionText = this.stripHtml(wiki.html);
    } else if (info?.descr) {
      descriptionText = this.stripHtml(info.descr);
    }

    return {
      xid,
      name,
      descriptionText,
      imageUrl: preview?.source ?? null,
      otmUrl: otm,
      rate: rate != null && !Number.isNaN(rate) ? rate : null,
    };
  }

  /**
   * Localiza la ciudad de destino en OpenTripMap (geoname → autosuggest → detalle por xid).
   * Opcionalmente usa coordenadas ya conocidas (p. ej. GeoDB) si geoname falla.
   */
  async resolveDestinationCityDetails(params: {
    cityLabel: string;
    latitude?: number | null;
    longitude?: number | null;
    lang?: string;
  }): Promise<OtmPlaceDetails | null> {
    const key = this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim();
    if (!key) {
      return null;
    }

    const lang = params.lang ?? 'es';
    const label = params.cityLabel.trim();
    if (!label) {
      return null;
    }

    let lat = params.latitude ?? null;
    let lon = params.longitude ?? null;

    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      const geo = await this.geonameLookup(label, lang);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
      }
    }

    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      this.logger.warn(`OpenTripMap: sin coordenadas para ciudad «${label}»`);
      return null;
    }

    let suggestions = await this.autosuggestPlaces({
      name: label,
      lat,
      lon,
      radiusMeters: 200_000,
      limit: 25,
      lang,
    });
    if (!suggestions.length && lang !== 'en') {
      suggestions = await this.autosuggestPlaces({
        name: label,
        lat,
        lon,
        radiusMeters: 200_000,
        limit: 25,
        lang: 'en',
      });
    }

    const xid = this.pickBestCityXid(label, suggestions);
    if (!xid) {
      this.logger.warn(`OpenTripMap autosuggest sin xid útil para «${label}»`);
      return null;
    }

    let details = await this.getPlaceDetails(xid, lang);
    if (details && !details.descriptionText && lang !== 'en') {
      details = await this.getPlaceDetails(xid, 'en');
    }
    return details;
  }

  private async geonameLookup(
    name: string,
    lang: string,
  ): Promise<{ lat: number; lon: number; name: string } | null> {
    const key = this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim();
    if (!key) {
      return null;
    }
    const q = new URLSearchParams({ name: name.trim(), apikey: key });
    const res = await fetch(
      `https://api.opentripmap.com/0.1/${lang}/places/geoname?${q}`,
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const st = data['status'];
    if (st !== 'OK' && st !== 'ok') {
      return null;
    }
    const latRaw = data['lat'];
    const lonRaw = data['lon'];
    const lat =
      typeof latRaw === 'number' ? latRaw : typeof latRaw === 'string' ? parseFloat(latRaw) : NaN;
    const lon =
      typeof lonRaw === 'number' ? lonRaw : typeof lonRaw === 'string' ? parseFloat(lonRaw) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }
    const n = (data['name'] as string | undefined) ?? name;
    return { lat, lon, name: n };
  }

  private async autosuggestPlaces(params: {
    name: string;
    lat: number;
    lon: number;
    radiusMeters: number;
    limit: number;
    lang: string;
  }): Promise<Array<{ xid: string; name: string; kinds?: string }>> {
    const key = this.config.get<string>('OPENTRIPMAP_API_KEY')?.trim();
    if (!key) {
      return [];
    }
    const q = new URLSearchParams({
      name: params.name.trim(),
      lat: String(params.lat),
      lon: String(params.lon),
      radius: String(params.radiusMeters),
      limit: String(Math.min(params.limit, 50)),
      apikey: key,
    });
    const res = await fetch(
      `https://api.opentripmap.com/0.1/${params.lang}/places/autosuggest?${q}`,
    );
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`OpenTripMap autosuggest error: ${res.status} ${text.slice(0, 160)}`);
      return [];
    }
    const json = (await res.json()) as unknown;
    return this.normalizeAutosuggestList(json);
  }

  private normalizeAutosuggestList(
    json: unknown,
  ): Array<{ xid: string; name: string; kinds?: string }> {
    const out: Array<{ xid: string; name: string; kinds?: string }> = [];

    const pushItem = (xid: unknown, name: unknown, kinds?: unknown) => {
      if (xid == null || typeof xid !== 'string') {
        return;
      }
      const nm = typeof name === 'string' ? name : xid;
      const k = typeof kinds === 'string' ? kinds : undefined;
      out.push({ xid, name: nm, kinds: k });
    };

    if (Array.isArray(json)) {
      for (const row of json) {
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          pushItem(r['xid'], r['name'], r['kinds']);
        }
      }
      return out;
    }

    if (json && typeof json === 'object') {
      const o = json as Record<string, unknown>;
      const features = o['features'];
      if (Array.isArray(features)) {
        for (const f of features) {
          if (f && typeof f === 'object') {
            const feat = f as Record<string, unknown>;
            const props = feat['properties'] as Record<string, unknown> | undefined;
            if (props) {
              pushItem(props['xid'], props['name'], props['kinds']);
            }
          }
        }
      }
    }

    return out;
  }

  private pickBestCityXid(
    cityLabel: string,
    items: Array<{ xid: string; name: string; kinds?: string }>,
  ): string | null {
    if (!items.length) {
      return null;
    }

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim();

    const target = norm(cityLabel.split(/[,(]/)[0] || cityLabel);

    let best: { xid: string; score: number } | null = null;

    for (const it of items) {
      let score = 0;
      const n = norm(it.name || '');
      if (n === target) {
        score += 120;
      } else if (n.startsWith(target + ' ') || n.startsWith(target + ',')) {
        score += 85;
      } else if (n.split(/\s+/).includes(target) || n.includes(', ' + target)) {
        score += 50;
      } else if (target.length >= 4 && n.includes(target)) {
        score += 35;
      }

      const kinds = (it.kinds ?? '').toLowerCase();
      if (
        kinds.includes('capital_cities') ||
        kinds.includes('big_cities') ||
        kinds.includes('historic_architecture')
      ) {
        score += 12;
      }
      if (kinds.includes('interesting_places')) {
        score += 4;
      }

      if (!best || score > best.score) {
        best = { xid: it.xid, score };
      }
    }

    if (best && best.score >= 30) {
      return best.xid;
    }
    if (items.length === 1) {
      return items[0].xid;
    }
    return null;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
