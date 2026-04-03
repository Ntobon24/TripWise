import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CitiesSearchQueryDto {
  @IsString()
  @MinLength(1)
  q: string;

  @IsOptional()
  @IsIn(['geodb', 'all'])
  provider?: 'geodb' | 'all';
}
