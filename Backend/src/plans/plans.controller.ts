import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { PlansService } from './plans.service';
import { CreateTravelPlanDto } from './dto/create-plan.dto';
import { UpdateTravelPlanDto } from './dto/update-plan.dto';

/**
 * HU-2, HU-6, HU-4 (persistido): planes asociados al viajero.
 * HU-19: guardar plan requiere sesión (401 sin token).
 */
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateTravelPlanDto) {
    return this.plans.create(userId, dto);
  }

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.plans.listForUser(userId);
  }

  @Get(':id')
  getOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.plans.getOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTravelPlanDto,
  ) {
    return this.plans.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.plans.remove(userId, id);
  }
}
