import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';


@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const serviceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
      this.config.get<string>('SUPABASE_SECRET_KEY')?.trim();

    if (!url || !serviceKey) {
      this.logger.warn(
        'Supabase admin client deshabilitado: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY).',
      );
      this.client = null;
      return;
    }

    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** null si no hay configuración válida */
  getClient(): SupabaseClient | null {
    return this.client;
  }
}
