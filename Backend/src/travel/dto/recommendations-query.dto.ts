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

export class RecommendationsQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  budget: number;

  @IsString()
  @MinLength(2)
  @MaxLength(8)
  originCityCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(8)
  destinationCityCode: string;

  @IsOptional()
  @IsString()
  originCityName?: string;

  @IsOptional()
  @IsString()
  destinationCityName?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'departureDate debe tener formato YYYY-MM-DD.',
  })
  departureDate?: string;
}
