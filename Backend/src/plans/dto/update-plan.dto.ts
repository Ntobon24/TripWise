import { PartialType } from '@nestjs/mapped-types';
import { CreateTravelPlanDto } from './create-plan.dto';

export class UpdateTravelPlanDto extends PartialType(CreateTravelPlanDto) {}
