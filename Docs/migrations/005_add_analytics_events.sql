-- =============================================================================
-- Migración 005 — Eventos de analítica (métricas de éxito) (Fase 6)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / DROP POLICY IF EXISTS.)
--
-- Qué hace:
--   Registro simple de eventos para medir el éxito del producto (tasa de
--   finalización de lecciones/quizzes, base para retención). Cada evento guarda
--   su tipo y metadatos flexibles en JSONB. El registro es "fire-and-forget":
--   si falla, no debe romper el flujo del usuario (fail-open en el helper).
--
--   Modelo:
--     auth.users
--       └─ analytics_events (1:N: muchos eventos por usuario)
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.analytics_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  event_type text        not null,
  metadata   jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

create index if not exists analytics_events_type_idx
  on public.analytics_events (event_type);

-- =============================================================================
-- Row Level Security: cada usuario solo ve/crea sus propios eventos.
-- =============================================================================
alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_select_own" on public.analytics_events;
create policy "analytics_events_select_own"
  on public.analytics_events for select
  using (auth.uid() = user_id);

drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);
