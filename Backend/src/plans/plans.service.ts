import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelPlan } from './entities/travel-plan.entity';
import { CreateTravelPlanDto } from './dto/create-plan.dto';
import { UpdateTravelPlanDto } from './dto/update-plan.dto';
import { RecommendationsService } from '../travel/recommendations.service';

const EMPTY_MESSAGE = 'No hay planes disponibles. Crea tu primer plan de viaje.';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(TravelPlan)
    private readonly plans: Repository<TravelPlan>,
    private readonly recommendations: RecommendationsService,
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
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
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
