import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AiExperienceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  budget!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(8)
  originCityCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originCityName?: string;

  @IsOptional()
  @IsIn(['europe', 'americas', 'asia', 'africa', 'oceania', 'any'])
  continent?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      return undefined;
    }
    return n;
  })
  @IsNumber()
  @Min(3)
  @Max(14)
  tripDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  interests?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  travelParty?: string;
}
