import type { FlightOfferSummary } from './flight-offer.mapper';

function bestPriceFromItinerary(it: Record<string, unknown>): number | null {
  const opts = it['pricing_options'] as Array<Record<string, unknown>> | undefined;
  if (!opts?.length) {
    return null;
  }
  let min: number | null = null;
  for (const o of opts) {
    const price = (o['price'] as Record<string, unknown> | undefined)?.['amount'];
    const n =
      typeof price === 'number' ? price : typeof price === 'string' ? parseFloat(price) : Number.NaN;
    if (!Number.isNaN(n) && (min === null || n < min)) {
      min = n;
    }
  }
  return min;
}

/** Normaliza respuesta FlightAPI (itineraries, legs, places, carriers). */
export function mapFlightApiResponseToSummaries(
  body: Record<string, unknown>,
  budget: number,
  currency: string,
): FlightOfferSummary[] {
  const itineraries = (body['itineraries'] as Record<string, unknown>[] | undefined) ?? [];
  const legs = (body['legs'] as Record<string, unknown>[] | undefined) ?? [];
  const places = (body['places'] as Record<string, unknown>[] | undefined) ?? [];
  const carriers = (body['carriers'] as Record<string, unknown>[] | undefined) ?? [];

  const legById = new Map<string, Record<string, unknown>>();
  for (const leg of legs) {
    const id = leg['id'];
    if (typeof id === 'string') {
      legById.set(id, leg);
    }
  }

  const placeById = new Map<number, string>();
  for (const p of places) {
    const id = p['id'];
    const iata =
      (p['iata'] as string | undefined) ??
      (p['iata_code'] as string | undefined) ??
      (p['short_name'] as string | undefined);
    if (typeof id === 'number' && typeof iata === 'string') {
      placeById.set(id, iata);
    }
  }

  const carrierById = new Map<number, string>();
  for (const c of carriers) {
    const id = c['id'];
    const code =
      (c['iata'] as string | undefined) ??
      (c['name'] as string | undefined) ??
      (c['display_code'] as string | undefined);
    if (typeof id === 'number' && typeof code === 'string') {
      carrierById.set(id, code);
    }
  }

  const currUpper = currency.toUpperCase();
  const out: FlightOfferSummary[] = [];

  for (const it of itineraries) {
    const itId = it['id'];
    const best = bestPriceFromItinerary(it);
    if (best == null) {
      continue;
    }

    const legIds = it['leg_ids'] as string[] | undefined;
    const firstLegId = legIds?.[0];
    if (!firstLegId) {
      continue;
    }
    const leg = legById.get(firstLegId);
    if (!leg) {
      continue;
    }

    const dep = leg['departure'] as string | undefined;
    const arr = leg['arrival'] as string | undefined;
    const stopCount =
      typeof leg['stop_count'] === 'number' ? (leg['stop_count'] as number) : 0;

    const oid = leg['origin_place_id'] as number | undefined;
    const did = leg['destination_place_id'] as number | undefined;
    const originAirport = oid != null ? placeById.get(oid) ?? null : null;
    const destinationAirport = did != null ? placeById.get(did) ?? null : null;

    const mcs = (leg['marketing_carrier_ids'] as number[] | undefined) ?? [];
    const carrierCodes = mcs.map((cid) => carrierById.get(cid) ?? String(cid));

    const summaryParts = [
      originAirport && destinationAirport ? `${originAirport} → ${destinationAirport}` : null,
      carrierCodes.length ? `Aerolínea(s): ${carrierCodes.join(', ')}` : null,
      stopCount > 0 ? `${stopCount} escala(s)` : 'Directo',
    ].filter(Boolean);

    out.push({
      id: typeof itId === 'string' ? itId : String(itId ?? 'flightapi'),
      totalPrice: best,
      currency: currUpper,
      withinBudget: best <= budget,
      carrierCodes,
      summary: summaryParts.join(' · '),
      departureAt: dep ?? null,
      arrivalAt: arr ?? null,
      originAirport,
      destinationAirport,
      stops: stopCount,
    });
  }

  return out.sort((a, b) => a.totalPrice - b.totalPrice);
}
