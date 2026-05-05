import { BadRequestException, Injectable } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import type { FlightOfferSummary } from './mappers/flight-offer.mapper';
import { mapFlightApiResponseToSummaries } from './mappers/flightapi-response.mapper';
import { mapOtmFeatureToSummary } from './mappers/otm-place.mapper';
import type { ActivitySummary } from './mappers/activity.mapper';
import { DESTINATION_POOL } from './destination-pool';
import { GroqService } from '../groq/groq.service';

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

export type AiExperienceInput = {
  budget: number;
  currency?: string;
  originCityCode: string;
  originCityName?: string;
  continent?: 'europe' | 'americas' | 'asia' | 'africa' | 'oceania' | 'any';
  tripDays?: number;
  interests?: string;
  pace?: string;
  travelParty?: string;
};

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly geodb: GeoDbService,
    private readonly flightApi: FlightApiService,
    private readonly otm: OpenTripMapService,
    private readonly groq: GroqService,
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
        limit: 40,
      });
      activities = feats
        .map((f) => mapOtmFeatureToSummary(f as Record<string, unknown>))
        .map((a) => ({
          ...a,
          withinBudget:
            typeof a.priceAmount === 'number' && !Number.isNaN(a.priceAmount)
              ? a.priceAmount <= input.budget
              : null,
        }))
        .filter((a) => (a.popularity ?? 0) >= 3)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 15);
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

  async buildAutoPlan(input: {
    budget: number;
    originCityCode: string;
    originCityName?: string;
  }) {
    this.assertValidBudget(input.budget);
    const origin = normalizeLocationCode(input.originCityCode.trim());
    const options = DESTINATION_POOL.filter(
      (d) =>
        d.cityCode !== origin &&
        input.budget >= d.minBudget * 0.75 &&
        input.budget <= d.maxBudget * 1.2,
    );
    const pool = options.length ? options : DESTINATION_POOL.filter((d) => d.cityCode !== origin);
    const index = Math.floor(Math.random() * Math.max(pool.length, 1));
    const picked = pool[index] ?? DESTINATION_POOL[0];

    const rec = await this.buildRecommendations({
      budget: input.budget,
      originCityCode: origin,
      originCityName: input.originCityName,
      destinationCityCode: picked.cityCode,
      destinationCityName: picked.cityName,
    });

    return {
      ...rec,
      meta: {
        ...rec.meta,
        source: 'auto-plan',
        note: 'Plan sugerido automaticamente segun tu presupuesto.',
      },
    };
  }

  async buildAiExperiencePlan(input: AiExperienceInput) {
    this.assertValidBudget(input.budget);
    if (!this.groq.isConfigured()) {
      throw new BadRequestException(
        'La IA no está disponible: configura GROQ_API_KEY en Backend/.env.',
      );
    }

    const origin = normalizeLocationCode(input.originCityCode.trim());
    let pool = DESTINATION_POOL.filter((d) => d.cityCode !== origin);

    if (input.continent && input.continent !== 'any') {
      const filtered = pool.filter((d) => d.continent === input.continent);
      if (filtered.length) {
        pool = filtered;
      }
    }

    pool = pool.filter(
      (d) => input.budget >= d.minBudget * 0.75 && input.budget <= d.maxBudget * 1.2,
    );
    if (!pool.length) {
      pool = DESTINATION_POOL.filter((d) => d.cityCode !== origin);
    }

    const poolForPrompt = pool.map((d) => ({
      cityCode: d.cityCode,
      cityName: d.cityName,
      continent: d.continent,
    }));

    const raw = (await this.groq.chatJson({
      system:
        'Eres un planificador de viajes. Debes elegir SOLO un destino de la lista JSON proporcionada por el usuario (campo cityCode debe coincidir exactamente). Responde SOLO un objeto JSON con: cityCode (string), tripDays (entero entre 3 y 14), title (string corto en español para el viaje), departureOffsetDays (entero entre 14 y 60: días desde hoy hasta la fecha de ida).',
      user: `Lista permitida: ${JSON.stringify(poolForPrompt)}
Presupuesto total orientativo: ${input.budget} ${(input.currency ?? 'USD').toUpperCase()}
Código de origen (referencia de aeropuerto/zona): ${origin}
Nombre origen: ${input.originCityName ?? '(no indicado)'}
Continente preferido: ${input.continent ?? 'cualquiera'}
Días deseados (si no tiene sentido, ignóralo): ${input.tripDays ?? 'elige tú'}
Intereses / tipo de viaje: ${input.interests ?? 'sin detalle'}
Ritmo: ${input.pace ?? 'sin preferencia'}
Compañía: ${input.travelParty ?? 'sin preferencia'}

cityCode DEBE ser uno de la lista. Variedad: evita repetir siempre el mismo destino si hay alternativas razonables.`,
    })) as Record<string, unknown>;

    const codeRaw = String(raw['cityCode'] ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 8);
    const picked =
      pool.find((p) => p.cityCode === codeRaw) ??
      pool[Math.floor(Math.random() * Math.max(pool.length, 1))] ??
      DESTINATION_POOL[0];

    const tripDays = Math.min(
      14,
      Math.max(3, Math.round(Number(raw['tripDays']) || input.tripDays || 7)),
    );
    const depOffset = Math.min(
      60,
      Math.max(14, Math.round(Number(raw['departureOffsetDays']) || 21)),
    );
    const title = String(raw['title'] ?? `Viaje a ${picked.cityName}`).slice(0, 200);

    const dep = new Date();
    dep.setDate(dep.getDate() + depOffset);
    const ret = new Date(dep);
    ret.setDate(ret.getDate() + tripDays);

    const departureDate = dep.toISOString().slice(0, 10);
    const returnDate = ret.toISOString().slice(0, 10);

    const rec = await this.buildRecommendations({
      budget: input.budget,
      currency: input.currency,
      originCityCode: origin,
      originCityName: input.originCityName,
      destinationCityCode: picked.cityCode,
      destinationCityName: picked.cityName,
      departureDate,
    });

    return {
      ...rec,
      returnDate,
      planTitle: title,
      meta: {
        ...rec.meta,
        source: 'ai-experience',
        note: 'Plan generado con IA a partir de tus preferencias.',
      },
    };
  }
}
