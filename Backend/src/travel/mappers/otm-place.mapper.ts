import type { ActivitySummary } from './activity.mapper';

/** GeoJSON Feature de OpenTripMap places/radius. */
export function mapOtmFeatureToSummary(feature: Record<string, unknown>): ActivitySummary {
  const props = feature['properties'] as Record<string, unknown> | undefined;
  const xid = props?.['xid'];
  const name = (props?.['name'] as string) ?? null;
  const dist = props?.['dist'];
  const distHint =
    typeof dist === 'number' && !Number.isNaN(dist)
      ? `Aprox. a ${Math.round(dist)} m del centro buscado`
      : null;

  return {
    id: xid != null ? String(xid) : 'otm',
    name,
    shortDescription: distHint,
    priceAmount: null,
    priceCurrency: null,
    withinBudget: null,
  };
}
