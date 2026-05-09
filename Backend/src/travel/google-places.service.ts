import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Respuesta mínima de Places API (New) para armar reseñas en el plan. */
export type GooglePlaceReviewPayload = {
  resourceName: string;
  displayTitle: string;
  rating: number | null;
  userRatingCount: number | null;
  descriptionText: string | null;
  googleMapsUri: string | null;
};

type LocalizedText = { text?: string };

function localizedPlain(v: unknown): string | null {
  if (!v || typeof v !== 'object') {
    return null;
  }
  const t = (v as LocalizedText).text;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

function stripNoise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

/** Campos solicitados en búsqueda textual (máscara obligatoria). */
const SEARCH_FIELD_MASK = [
  'places.name',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.reviews',
  'places.googleMapsUri',
  'places.editorialSummary',
  'places.reviewSummary',
].join(',');

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim();
  }

  /**
   * Primera coincidencia para una consulta libre (ciudad o «lugar, ciudad»).
   * Usa sesgo circular opcional alrededor del destino (GeoDB).
   */
  async searchFirstPlaceWithReviews(
    textQuery: string,
    bias?: { latitude: number; longitude: number },
  ): Promise<GooglePlaceReviewPayload | null> {
    const key = this.apiKey();
    if (!key || !textQuery.trim()) {
      return null;
    }

    const body: Record<string, unknown> = {
      textQuery: textQuery.trim(),
      languageCode: 'es',
      pageSize: 3,
    };

    if (bias) {
      body.locationBias = {
        circle: {
          center: { latitude: bias.latitude, longitude: bias.longitude },
          radius: 50000,
        },
      };
    }

    let res: Response;
    try {
      res = await fetch(SEARCH_TEXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.warn(`Google Places fetch error: ${String(e)}`);
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Google Places searchText ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }

    const places = (data as { places?: unknown[] })?.places;
    if (!Array.isArray(places) || places.length === 0) {
      return null;
    }

    const place = places[0] as Record<string, unknown>;
    return this.mapPlaceToPayload(place);
  }

  private mapPlaceToPayload(place: Record<string, unknown>): GooglePlaceReviewPayload | null {
    const resourceName = typeof place['name'] === 'string' ? place['name'] : '';
    if (!resourceName) {
      return null;
    }

    const displayTitle =
      localizedPlain(place['displayName']) ||
      localizedPlain(place['formattedAddress']) ||
      'Lugar';

    const ratingRaw = place['rating'];
    const rating =
      typeof ratingRaw === 'number' && !Number.isNaN(ratingRaw)
        ? ratingRaw
        : typeof ratingRaw === 'string'
          ? parseFloat(ratingRaw)
          : null;
    const ratingOk = rating != null && !Number.isNaN(rating) ? rating : null;

    const countRaw = place['userRatingCount'];
    const userRatingCount =
      typeof countRaw === 'number' && Number.isFinite(countRaw)
        ? countRaw
        : typeof countRaw === 'string'
          ? parseInt(countRaw, 10)
          : null;

    const mapsUri =
      typeof place['googleMapsUri'] === 'string' && place['googleMapsUri'].trim()
        ? place['googleMapsUri'].trim()
        : null;

    const descriptionText = this.buildDescriptionText(place);

    return {
      resourceName,
      displayTitle: stripNoise(displayTitle),
      rating: ratingOk,
      userRatingCount:
        userRatingCount != null && !Number.isNaN(userRatingCount) ? userRatingCount : null,
      descriptionText,
      googleMapsUri: mapsUri,
    };
  }

  private buildDescriptionText(place: Record<string, unknown>): string | null {
    const chunks: string[] = [];

    const rs = place['reviewSummary'];
    const summaryAgg =
      rs && typeof rs === 'object'
        ? localizedPlain((rs as Record<string, unknown>)['text'])
        : null;
    if (summaryAgg) {
      chunks.push(summaryAgg);
    }

    const editorial = localizedPlain(place['editorialSummary']);
    const reviewsRaw = place['reviews'];
    const reviews = Array.isArray(reviewsRaw) ? reviewsRaw : [];

    for (const r of reviews) {
      if (!r || typeof r !== 'object') {
        continue;
      }
      const row = r as Record<string, unknown>;
      const text =
        localizedPlain(row['text']) ?? localizedPlain(row['originalText']) ?? null;
      if (!text) {
        continue;
      }
      const author = row['authorAttribution'] as Record<string, unknown> | undefined;
      const authorName =
        typeof author?.['displayName'] === 'string' ? author['displayName'].trim() : 'Usuario';
      const starsRaw = row['rating'];
      const stars =
        typeof starsRaw === 'number' && !Number.isNaN(starsRaw)
          ? starsRaw
          : typeof starsRaw === 'string'
            ? parseFloat(starsRaw)
            : null;
      const starNote = stars != null && !Number.isNaN(stars) ? ` (${stars.toFixed(1)}★)` : '';
      chunks.push(`«${text}» — ${authorName}${starNote}`);
    }

    if (chunks.length === 0 && editorial) {
      chunks.push(editorial);
    }

    const joined = chunks.join('\n\n').trim();
    return joined.length ? joined : null;
  }
}
