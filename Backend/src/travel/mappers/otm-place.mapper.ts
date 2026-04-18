import type { ActivitySummary } from './activity.mapper';

/** GeoJSON Feature de OpenTripMap places/radius. */
export function mapOtmFeatureToSummary(feature: Record<string, unknown>): ActivitySummary {
  const props = feature['properties'] as Record<string, unknown> | undefined;
  const xid = props?.['xid'];
  const name = (props?.['name'] as string) ?? null;
  const dist = props?.['dist'];
  const kindsRaw = (props?.['kinds'] as string | undefined)?.toLowerCase() ?? '';
  const rateRaw = props?.['rate'];
  const popularity =
    typeof rateRaw === 'number'
      ? rateRaw
      : typeof rateRaw === 'string'
        ? parseFloat(rateRaw)
        : null;
  const distHint =
    typeof dist === 'number' && !Number.isNaN(dist)
      ? `Aprox. a ${Math.round(dist)} m del centro buscado`
      : null;
  const category = deriveCategory(kindsRaw);
  const estimatedPrice = estimatePriceByCategory(category, {
    idSeed: xid != null ? String(xid) : 'otm',
    popularity: popularity ?? 3,
    distanceMeters: typeof dist === 'number' ? dist : 1200,
  });

  return {
    id: xid != null ? String(xid) : 'otm',
    name,
    shortDescription: distHint,
    category,
    popularity: popularity != null && !Number.isNaN(popularity) ? popularity : null,
    priceAmount: estimatedPrice,
    priceCurrency: 'USD',
    estimatedPrice: true,
    withinBudget: null,
  };
}

function deriveCategory(kindsRaw: string): string {
  if (kindsRaw.includes('museums') || kindsRaw.includes('cultural')) return 'Cultura';
  if (kindsRaw.includes('architecture') || kindsRaw.includes('historic')) return 'Historia';
  if (
    kindsRaw.includes('climbing') ||
    kindsRaw.includes('sport') ||
    kindsRaw.includes('hiking') ||
    kindsRaw.includes('skiing')
  ) {
    return 'Extremo';
  }
  if (kindsRaw.includes('foods') || kindsRaw.includes('restaurants')) return 'Gastronomia';
  if (kindsRaw.includes('natural') || kindsRaw.includes('parks')) return 'Naturaleza';
  if (kindsRaw.includes('nightclubs') || kindsRaw.includes('entertainments')) return 'Entretenimiento';
  return 'Turismo';
}

function estimatePriceByCategory(
  category: string,
  ctx: { idSeed: string; popularity: number; distanceMeters: number },
): number {
  const baseByCategory: Record<string, number> = {
    Cultura: 26,
    Historia: 19,
    Extremo: 52,
    Gastronomia: 34,
    Naturaleza: 16,
    Entretenimiento: 40,
    Turismo: 24,
  };
  const base = baseByCategory[category] ?? 24;
  const hash = simpleHash(ctx.idSeed);
  const variability = (hash % 19) - 9; // -9 ... +9
  const popularityFactor = Math.max(0, (ctx.popularity - 3) * 2.4);
  const distanceFactor = Math.min(8, Math.max(-3, (ctx.distanceMeters - 1000) / 1800));
  const estimated = base + variability + popularityFactor + distanceFactor;
  return Math.max(8, Math.round(estimated));
}

function simpleHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
