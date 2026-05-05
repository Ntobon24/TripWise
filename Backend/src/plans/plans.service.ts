import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelPlan } from './entities/travel-plan.entity';
import { CreateTravelPlanDto } from './dto/create-plan.dto';
import { UpdateTravelPlanDto } from './dto/update-plan.dto';
import { RecommendationsService } from '../travel/recommendations.service';
import type { AiExperienceInput } from '../travel/recommendations.service';
import { OpenTripMapService } from '../travel/opentripmap.service';
import { GeoDbService } from '../travel/geodb.service';
import { GroqService } from '../groq/groq.service';
import type { FlightOfferSummary } from '../travel/mappers/flight-offer.mapper';
import type { ActivitySummary } from '../travel/mappers/activity.mapper';
import { AiExperienceDto } from './dto/ai-experience.dto';

const EMPTY_MESSAGE = 'No hay planes disponibles. Crea tu primer plan de viaje.';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(TravelPlan)
    private readonly plans: Repository<TravelPlan>,
    private readonly recommendations: RecommendationsService,
    private readonly otm: OpenTripMapService,
    private readonly geodb: GeoDbService,
    private readonly groq: GroqService,
  ) {}

  async create(userId: string, dto: CreateTravelPlanDto) {
    this.validateDates(dto.departureDate, dto.returnDate);
    const selectedFlight = this.toRecordOrNull(dto.selectedFlight);
    const selectedActivities = this.toRecordArray(dto.selectedActivities);
    const hasSelections =
      Boolean(selectedFlight) || Boolean(selectedActivities.length);

    const plan = this.plans.create({
      userId,
      title: dto.title?.trim() || 'Mi viaje',
      budgetAmount: String(dto.budgetAmount),
      currency: dto.currency?.trim().toUpperCase() || 'USD',
      originCityCode: dto.originCityCode?.trim().toUpperCase() ?? null,
      originCityName: dto.originCityName?.trim() ?? null,
      destinationCityCode: dto.destinationCityCode?.trim().toUpperCase() ?? null,
      destinationCityName: dto.destinationCityName?.trim() ?? null,
      departureDate: dto.departureDate ?? null,
      returnDate: dto.returnDate ?? null,
      selectedFlightJson: selectedFlight,
      selectedActivitiesJson: selectedActivities,
      selectionsLocked: dto.lockSelections ?? hasSelections,
    });

    plan.recommendationsJson = hasSelections
      ? this.buildSelectionsSnapshot(plan)
      : await this.maybeRefreshRecommendations(plan);
    const saved = await this.plans.save(plan);
    return this.mapPlan(saved);
  }

  async listForUser(userId: string) {
    const rows = await this.plans.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return {
      success: true,
      plans: rows.map((r) => this.mapPlan(r)),
      ...(rows.length === 0 ? { message: EMPTY_MESSAGE } : {}),
    };
  }

  async getOne(userId: string, id: string) {
    const plan = await this.plans.findOne({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    return this.mapPlan(plan);
  }

  /** Reseñas / descripción OpenTripMap para la ciudad de destino del plan (no por actividad). */
  async getPlaceReviewsForPlan(userId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, userId } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }

    if (!this.otm.isConfigured()) {
      return {
        success: true,
        openTripMapConfigured: false,
        reviewScope: 'destination' as const,
        hint: 'Configura OPENTRIPMAP_API_KEY en el servidor para ver reseñas e información del destino.',
        places: [] as Array<{
          activityId: string;
          activityName: string;
          name: string | null;
          descriptionText: string | null;
          imageUrl: string | null;
          otmUrl: string | null;
          rate: number | null;
        }>,
      };
    }

    const displayName = (
      plan.destinationCityName?.trim() ||
      plan.destinationCityCode?.trim() ||
      ''
    ).trim();

    if (!displayName) {
      return {
        success: true,
        openTripMapConfigured: true,
        reviewScope: 'destination' as const,
        hint: 'Añade la ciudad de destino al plan para ver la información del destino.',
        places: [],
      };
    }

    let lat: number | undefined;
    let lon: number | undefined;
    if (this.geodb.isConfigured()) {
      const c = await this.geodb.getFirstCityCoords(displayName);
      if (c) {
        lat = c.latitude;
        lon = c.longitude;
      }
    }

    const details = await this.otm.resolveDestinationCityDetails({
      cityLabel: displayName,
      latitude: lat ?? null,
      longitude: lon ?? null,
    });

    if (!details) {
      return {
        success: true,
        openTripMapConfigured: true,
        reviewScope: 'destination' as const,
        hint: `No se encontró información en OpenTripMap para «${displayName}». Comprueba el nombre de la ciudad.`,
        places: [],
      };
    }

    const title = details.name ?? displayName;

    return {
      success: true,
      openTripMapConfigured: true,
      reviewScope: 'destination' as const,
      destinationLabel: displayName,
      places: [
        {
          activityId: details.xid,
          activityName: title,
          name: details.name,
          descriptionText: details.descriptionText,
          imageUrl: details.imageUrl,
          otmUrl: details.otmUrl,
          rate: details.rate,
        },
      ],
    };
  }

  async update(userId: string, id: string, dto: UpdateTravelPlanDto) {
    const plan = await this.plans.findOne({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    this.validateDates(
      dto.departureDate ?? plan.departureDate ?? undefined,
      dto.returnDate ?? plan.returnDate ?? undefined,
    );

    const previousOrigin = plan.originCityCode;
    const previousDest = plan.destinationCityCode;
    const previousOriginName = plan.originCityName;
    const previousDestName = plan.destinationCityName;

    if (dto.title !== undefined) {
      plan.title = dto.title.trim();
    }
    if (dto.budgetAmount !== undefined) {
      plan.budgetAmount = String(dto.budgetAmount);
    }
    if (dto.currency !== undefined) {
      plan.currency = dto.currency.trim().toUpperCase();
    }
    if (dto.originCityCode !== undefined) {
      plan.originCityCode = dto.originCityCode?.trim().toUpperCase() ?? null;
    }
    if (dto.originCityName !== undefined) {
      plan.originCityName = dto.originCityName?.trim() ?? null;
    }
    if (dto.destinationCityCode !== undefined) {
      plan.destinationCityCode = dto.destinationCityCode?.trim().toUpperCase() ?? null;
    }
    if (dto.destinationCityName !== undefined) {
      plan.destinationCityName = dto.destinationCityName?.trim() ?? null;
    }
    if (dto.departureDate !== undefined) {
      plan.departureDate = dto.departureDate ?? null;
    }
    if (dto.returnDate !== undefined) {
      plan.returnDate = dto.returnDate ?? null;
    }

    const routeChanged =
      previousOrigin !== plan.originCityCode ||
      previousDest !== plan.destinationCityCode ||
      this.normalizePlaceLabel(previousOriginName) !== this.normalizePlaceLabel(plan.originCityName) ||
      this.normalizePlaceLabel(previousDestName) !== this.normalizePlaceLabel(plan.destinationCityName);

    if (dto.selectedFlight !== undefined) {
      plan.selectedFlightJson = this.toRecordOrNull(dto.selectedFlight);
    } else if (routeChanged) {
      plan.selectedFlightJson = null;
    }
    if (dto.selectedActivities !== undefined) {
      plan.selectedActivitiesJson = this.toRecordArray(dto.selectedActivities);
    } else if (routeChanged) {
      plan.selectedActivitiesJson = [];
    }
    if (dto.lockSelections !== undefined) {
      plan.selectionsLocked = dto.lockSelections;
    } else if (routeChanged) {
      plan.selectionsLocked = false;
    } else if (dto.selectedFlight !== undefined || dto.selectedActivities !== undefined) {
      plan.selectionsLocked = true;
    }

    if (routeChanged) {
      plan.recommendationsJson = null;
      plan.aiLodgingEstimate = null;
      plan.aiFoodEstimate = null;
    }

    const shouldKeepSelections =
      plan.selectionsLocked &&
      (Boolean(plan.selectedFlightJson) || Boolean(plan.selectedActivitiesJson?.length));
    plan.recommendationsJson = shouldKeepSelections
      ? this.buildSelectionsSnapshot(plan)
      : await this.maybeRefreshRecommendations(plan);

    const saved = await this.plans.save(plan);
    return this.mapPlan(saved);
  }

  async remove(userId: string, id: string) {
    const res = await this.plans.delete({ id, userId });
    if (!res.affected) {
      throw new NotFoundException('Plan no encontrado.');
    }
    return { success: true, message: 'Plan eliminado.' };
  }

  private mapPlan(plan: TravelPlan) {
    return {
      id: plan.id,
      title: plan.title,
      budgetAmount: parseFloat(plan.budgetAmount),
      currency: plan.currency,
      originCityCode: plan.originCityCode,
      originCityName: plan.originCityName,
      destinationCityCode: plan.destinationCityCode,
      destinationCityName: plan.destinationCityName,
      departureDate: plan.departureDate,
      returnDate: plan.returnDate,
      recommendations: plan.recommendationsJson,
      selectedFlight: plan.selectedFlightJson,
      selectedActivities: plan.selectedActivitiesJson ?? [],
      selectionsLocked: plan.selectionsLocked,
      aiLodgingEstimate:
        plan.aiLodgingEstimate != null ? parseFloat(plan.aiLodgingEstimate) : null,
      aiFoodEstimate: plan.aiFoodEstimate != null ? parseFloat(plan.aiFoodEstimate) : null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  async createFromAiExperience(userId: string, dto: AiExperienceDto) {
    const pack = await this.recommendations.buildAiExperiencePlan({
      budget: dto.budget,
      currency: dto.currency,
      originCityCode: dto.originCityCode,
      originCityName: dto.originCityName,
      continent: dto.continent as AiExperienceInput['continent'],
      tripDays: dto.tripDays,
      interests: dto.interests,
      pace: dto.pace,
      travelParty: dto.travelParty,
    });

    type PackExtra = typeof pack & { returnDate?: string; planTitle?: string };
    const px = pack as PackExtra;
    const flights = pack.flights ?? [];
    const selectedFlight = this.pickFlightForPlan(flights, dto.budget);
    if (!selectedFlight) {
      throw new BadRequestException(
        'No hay vuelos disponibles para el destino elegido. Prueba otro presupuesto u otro código de origen.',
      );
    }
    const flightCost = selectedFlight.totalPrice ?? 0;
    const remaining = Math.max(0, dto.budget - flightCost);
    const selectedActivities = this.pickActivitiesForPlan(pack.activities ?? [], remaining);

    const currency =
      dto.currency?.trim().toUpperCase() ?? pack.currency?.trim().toUpperCase() ?? 'USD';

    return this.create(userId, {
      title: px.planTitle ?? `Viaje a ${pack.destination.name ?? pack.destination.code}`,
      budgetAmount: dto.budget,
      currency,
      originCityCode: dto.originCityCode.trim().toUpperCase(),
      originCityName: dto.originCityName?.trim(),
      destinationCityCode: pack.destination.code,
      destinationCityName: pack.destination.name ?? undefined,
      departureDate: pack.departureDate ?? undefined,
      returnDate: px.returnDate ?? undefined,
      selectedFlight: selectedFlight as unknown as Record<string, unknown>,
      selectedActivities: selectedActivities as unknown as Record<string, unknown>[],
      lockSelections: true,
    });
  }

  async refreshAiBudgetEstimates(userId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, userId } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (!this.groq.isConfigured()) {
      throw new BadRequestException(
        'La estimación por IA no está disponible: configura GROQ_API_KEY en Backend/.env.',
      );
    }
    const city = plan.destinationCityName?.trim() || plan.destinationCityCode?.trim();
    if (!city) {
      throw new BadRequestException('Indica una ciudad de destino en el plan.');
    }

    let nights = 5;
    if (
      plan.departureDate &&
      plan.returnDate &&
      DATE_RE.test(plan.departureDate) &&
      DATE_RE.test(plan.returnDate)
    ) {
      const d0 = new Date(plan.departureDate + 'T12:00:00');
      const d1 = new Date(plan.returnDate + 'T12:00:00');
      const diff = Math.round((d1.getTime() - d0.getTime()) / 86400000);
      nights = Math.max(1, Math.min(30, diff));
    }

    const budget = parseFloat(plan.budgetAmount);
    const currency = plan.currency;

    const raw = (await this.groq.chatJson({
      system:
        'Eres un analista de presupuesto de viajes. Responde SOLO un objeto JSON con las claves lodgingTotal y foodTotal (números, sin texto). Son estimaciones TOTALES para todo el viaje del usuario (no por noche ni por día sueltos): hospedaje calculado para todas las noches del viaje, y comidas para todos los días del viaje. Perfil turista gama media. Los importes deben expresarse en la misma moneda indicada.',
      user: `Ciudad de destino: ${city}. Moneda: ${currency}. Presupuesto total declarado del viaje (referencia): ${budget}. Número de noches de estancia: ${nights}.`,
    })) as Record<string, unknown>;

    let lodging = Number(raw['lodgingTotal']);
    let food = Number(raw['foodTotal']);
    if (!Number.isFinite(lodging) || lodging < 0) {
      lodging = 0;
    }
    if (!Number.isFinite(food) || food < 0) {
      food = 0;
    }

    plan.aiLodgingEstimate = String(Math.round(lodging * 100) / 100);
    plan.aiFoodEstimate = String(Math.round(food * 100) / 100);
    const saved = await this.plans.save(plan);
    return this.mapPlan(saved);
  }

  private pickFlightForPlan(
    flights: FlightOfferSummary[],
    budget: number,
  ): FlightOfferSummary | null {
    if (!flights.length) {
      return null;
    }
    const within = flights.filter((f) => f.withinBudget);
    const pool = within.length ? within : flights;
    return [...pool].sort((a, b) => a.totalPrice - b.totalPrice)[0] ?? null;
  }

  private pickActivitiesForPlan(
    activities: ActivitySummary[],
    remainingBudget: number,
  ): ActivitySummary[] {
    if (remainingBudget <= 0 || !activities.length) {
      return [];
    }
    const sorted = [...activities].sort(
      (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    );
    const picked: ActivitySummary[] = [];
    let remaining = remainingBudget;
    for (const activity of sorted) {
      const price = activity.priceAmount ?? 0;
      if (price <= remaining) {
        picked.push(activity);
        remaining -= price;
      }
      if (picked.length >= 6) {
        break;
      }
    }
    return picked;
  }

  private buildSelectionsSnapshot(plan: TravelPlan) {
    return {
      budget: parseFloat(plan.budgetAmount),
      currency: plan.currency,
      origin: { code: plan.originCityCode, name: plan.originCityName },
      destination: { code: plan.destinationCityCode, name: plan.destinationCityName },
      departureDate: plan.departureDate,
      flights: plan.selectedFlightJson ? [plan.selectedFlightJson] : [],
      activities: plan.selectedActivitiesJson ?? [],
      meta: {
        source: 'saved-plan-selection',
        locked: true,
        note: 'Mostrando únicamente vuelo y actividades seleccionadas.',
      },
    } as Record<string, unknown>;
  }

  private toRecordOrNull(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private normalizePlaceLabel(name: string | null | undefined): string {
    return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private validateDates(departureDate?: string, returnDate?: string) {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (departureDate && !DATE_RE.test(departureDate)) {
      throw new BadRequestException('La fecha de ida no es válida.');
    }
    if (returnDate && !DATE_RE.test(returnDate)) {
      throw new BadRequestException('La fecha de regreso no es válida.');
    }
    if (departureDate && departureDate < todayIso) {
      throw new BadRequestException('La fecha de ida no puede ser anterior a hoy.');
    }
    if (departureDate && returnDate && returnDate < departureDate) {
      throw new BadRequestException('La fecha de regreso no puede ser anterior a la ida.');
    }
  }

  private async maybeRefreshRecommendations(plan: TravelPlan) {
    const origin = plan.originCityCode;
    const dest = plan.destinationCityCode;
    const budget = parseFloat(plan.budgetAmount);
    if (!origin || !dest) {
      return plan.recommendationsJson;
    }

    try {
      this.recommendations.assertValidBudget(budget);
    } catch {
      return plan.recommendationsJson;
    }

    try {
      const rec = await this.recommendations.buildRecommendations({
        budget,
        currency: plan.currency,
        originCityCode: origin,
        originCityName: plan.originCityName ?? undefined,
        destinationCityCode: dest,
        destinationCityName: plan.destinationCityName ?? undefined,
        departureDate: plan.departureDate ?? undefined,
      });
      return rec as Record<string, unknown>;
    } catch {
      return plan.recommendationsJson;
    }
  }
}
