import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Viator Partner API requiere alta en el programa de partners.
 * Si VIATOR_API_KEY está definida, el backend puede ampliarse aquí.
 */
@Injectable()
export class ViatorService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('VIATOR_API_KEY')?.trim());
  }
}
