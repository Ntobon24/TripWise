import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AutoPlanQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  budget: number;

  @IsString()
  @MinLength(2)
  @MaxLength(8)
  originCityCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originCityName?: string;
}
