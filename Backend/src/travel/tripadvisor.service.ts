import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TripAdvisor Content API suele requerir acuerdo comercial / aprobación.
 * Si TRIPADVISOR_API_KEY está definida, el backend puede ampliarse aquí (REST partner).
 */
@Injectable()
export class TripAdvisorService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('TRIPADVISOR_API_KEY')?.trim());
  }
}
