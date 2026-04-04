import { ConfigService } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TravelPlan } from '../plans/entities/travel-plan.entity';

export function buildTypeOrmOptions(config: ConfigService): DataSourceOptions {
  const synchronize = config.get<string>('DATABASE_SYNCHRONIZE') === 'true';
  const databaseUrl = config.get<string>('DATABASE_URL')?.trim();

  const common = {
    entities: [User, TravelPlan],
    synchronize,
    ssl: { rejectUnauthorized: false } as const,
  };

  if (databaseUrl) {
    return {
      type: 'postgres' as const,
      url: databaseUrl,
      ...common,
    };
  }

  const password = config.get<string>('SUPABASE_DB_PASSWORD')?.trim();
  if (!password) {
    throw new Error(
      'Configura DATABASE_URL (URI completo de Supabase) o SUPABASE_DB_PASSWORD en Backend/.env. ' +
        'La contraseña está en Supabase → Project Settings → Database (no es la anon key).',
    );
  }

  const usePooler = config.get<string>('SUPABASE_USE_POOLER') === 'true';
  const poolerRegion = config.get<string>('SUPABASE_POOLER_REGION')?.trim();
  const projectRef =
    config.get<string>('SUPABASE_PROJECT_REF')?.trim() ?? 'mraymbkqtcnxpxdixkhi';

  if (usePooler && poolerRegion) {
    return {
      type: 'postgres' as const,
      host: `aws-0-${poolerRegion}.pooler.supabase.com`,
      port: parseInt(config.get<string>('SUPABASE_POOLER_PORT') ?? '5432', 10),
      username: `postgres.${projectRef}`,
      password,
      database: config.get<string>('SUPABASE_DB_NAME') ?? 'postgres',
      ...common,
    };
  }

  return {
    type: 'postgres' as const,
    host: config.getOrThrow<string>('SUPABASE_DB_HOST'),
    port: parseInt(config.get<string>('SUPABASE_DB_PORT') ?? '5432', 10),
    username: config.get<string>('SUPABASE_DB_USER') ?? 'postgres',
    password,
    database: config.get<string>('SUPABASE_DB_NAME') ?? 'postgres',
    ...common,
  };
}
