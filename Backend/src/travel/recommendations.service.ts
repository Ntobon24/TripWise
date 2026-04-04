import { BadRequestException, Injectable } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import type { FlightOfferSummary } from './mappers/flight-offer.mapper';
import { mapFlightApiResponseToSummaries } from './mappers/flightapi-response.mapper';
import { mapOtmFeatureToSummary } from './mappers/otm-place.mapper';
import type { ActivitySummary } from './mappers/activity.mapper';

export type BudgetRecommendationInput = {
  budget: number;
  currency?: string;
  originCityCode: string;
  originCityName?: string;
  destinationCityCode: string;
  destinationCityName?: string;
  departureDate?: string;
};

const MIN_BUDGET = 0.01;
const MAX_BUDGET = 10_000_000;

function defaultDepartureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}


function normalizeLocationCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly geodb: GeoDbService,
    private readonly flightApi: FlightApiService,
    private readonly otm: OpenTripMapService,
  ) {}

  assertValidBudget(budget: number) {
    if (Number.isNaN(budget) || budget < MIN_BUDGET || budget > MAX_BUDGET) {
      throw new BadRequestException(
        'El presupuesto no es válido. Indica un valor positivo dentro de un rango razonable.',
      );
    }
  }

  private async getDestinationCoords(
    destCode: string,
    destLabel: string | null | undefined,
  ): Promise<{ lat: number; lng: number; label: string | null } | null> {
    const keyword = (destLabel ?? destCode).slice(0, 80);
    if (!this.geodb.isConfigured()) {
      return null;
    }
    const c = await this.geodb.getFirstCityCoords(keyword);
    if (!c) {
      return null;
    }
    return { lat: c.latitude, lng: c.longitude, label: destLabel ?? null };
  }

  async buildRecommendations(input: BudgetRecommendationInput) {
    this.assertValidBudget(input.budget);

    const origin = normalizeLocationCode(input.originCityCode.trim());
    const dest = normalizeLocationCode(input.destinationCityCode.trim());
    let originLabel = input.originCityName?.trim() || null;
    let destLabel = input.destinationCityName?.trim() || null;
    const departureDate = input.departureDate?.trim() || defaultDepartureDate();
    const currency = (input.currency ?? 'USD').trim().toUpperCase();

    if (origin.length < 2 || dest.length < 2) {
      throw new BadRequestException(
        'Indica al menos 2 letras para origen y destino (p. ej. MX, MEX, BOG, MAD).',
      );
    }

    if (!this.flightApi.isConfigured()) {
      return {
        budget: input.budget,
        currency,
        origin: { code: origin, name: originLabel },
        destination: { code: dest, name: destLabel },
        departureDate,
        flights: [] as FlightOfferSummary[],
        activities: [] as ActivitySummary[],
        meta: {
          source: 'tripwise',
          flightProvider: null as string | null,
          flightApiConfigured: false,
          geodbConfigured: this.geodb.isConfigured(),
          openTripMapConfigured: this.otm.isConfigured(),
          message:
            'Sin vuelos: añade FLIGHTAPI_API_KEY en Backend/.env (https://www.flightapi.io/). Para puntos de interés: OPENTRIPMAP_API_KEY y GEODB_RAPIDAPI_KEY.',
        },
      };
    }

    const raw = await this.flightApi.searchOneway({
      departureAirport: origin,
      arrivalAirport: dest,
      departureDate,
      currency,
    });

    const flightRows: FlightOfferSummary[] = raw
      ? mapFlightApiResponseToSummaries(raw, input.budget, currency)
      : [];

    const within = flightRows.filter((f) => f.withinBudget);
    const flightsPick = within.length ? within : flightRows.slice(0, 12);

    let activities: ActivitySummary[] = [];
    const coords = await this.getDestinationCoords(dest, destLabel);
    if (coords && !destLabel && coords.label) {
      destLabel = coords.label;
    }

    if (coords && this.otm.isConfigured()) {
      const feats = await this.otm.searchPlacesAroundRadius({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: 8000,
        limit: 25,
      });
      activities = feats
        .map((f) => mapOtmFeatureToSummary(f as Record<string, unknown>))
        .slice(0, 20);
    }

    const actsInBudget = activities.filter((a) => a.withinBudget === true);

    const note =
      within.length === 0 && flightRows.length > 0
        ? 'Ningún vuelo de las primeras opciones entra en tu presupuesto; mostramos los más económicos.'
        : flightRows.length === 0
          ? 'No hay itinerarios para esta ruta/fecha. Prueba otras fechas o otros códigos IATA de aeropuerto.'
          : undefined;

    return {
      budget: input.budget,
      currency,
      origin: { code: origin, name: originLabel },
      destination: { code: dest, name: destLabel },
      departureDate,
      flights: flightsPick,
      activities: actsInBudget.length ? actsInBudget.slice(0, 15) : activities.slice(0, 12),
      meta: {
        source: 'flightapi',
        flightProvider: 'flightapi',
        flightApiConfigured: true,
        geodbConfigured: this.geodb.isConfigured(),
        openTripMapConfigured: this.otm.isConfigured(),
        flightsFound: flightRows.length,
        note,
      },
    };
  }
}
