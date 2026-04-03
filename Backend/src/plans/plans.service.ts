import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelPlan } from './entities/travel-plan.entity';
import { CreateTravelPlanDto } from './dto/create-plan.dto';
import { UpdateTravelPlanDto } from './dto/update-plan.dto';
import { RecommendationsService } from '../travel/recommendations.service';

const EMPTY_MESSAGE = 'No hay planes disponibles. Crea tu primer plan de viaje.';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(TravelPlan)
    private readonly plans: Repository<TravelPlan>,
    private readonly recommendations: RecommendationsService,
  ) {}

  async create(userId: string, dto: CreateTravelPlanDto) {
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
    });

    plan.recommendationsJson = await this.maybeRefreshRecommendations(plan);
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

    plan.recommendationsJson = await this.maybeRefreshRecommendations(plan);
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
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
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
  }
}
