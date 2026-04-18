import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaBootstrapService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.ensureTravelPlansSelectionColumns();
  }

  private async ensureTravelPlansSelectionColumns() {
    const query = `
      alter table if exists public.travel_plans
        add column if not exists selected_flight_json jsonb,
        add column if not exists selected_activities_json jsonb,
        add column if not exists selections_locked boolean not null default false;
    `;

    try {
      await this.dataSource.query(query);
      this.logger.log('Esquema verificado: columnas de selecciones en travel_plans listas.');
    } catch (error) {
      this.logger.error(
        'No se pudo verificar/actualizar el esquema de travel_plans.',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
