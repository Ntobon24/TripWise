alter table if exists public.travel_plans
  add column if not exists selected_flight_json jsonb,
  add column if not exists selected_activities_json jsonb,
  add column if not exists selections_locked boolean not null default false;

comment on column public.travel_plans.selected_flight_json is
  'Vuelo seleccionado por el usuario al crear/editar su plan';
comment on column public.travel_plans.selected_activities_json is
  'Actividades seleccionadas por el usuario en su plan';
comment on column public.travel_plans.selections_locked is
  'Si es true, no se recalculan recomendaciones al visualizar/guardar';
