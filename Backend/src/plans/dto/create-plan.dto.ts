import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTravelPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  budgetAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  originCityCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originCityName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  destinationCityCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  destinationCityName?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  departureDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  returnDate?: string;
}
