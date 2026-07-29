-- =============================================================================
-- Migración 002 — Progreso de lecciones (Fase 4)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / DROP POLICY IF EXISTS.)
--
-- Qué hace:
--   Crea la tabla `lesson_progress`, que guarda el avance del estudiante en las
--   lecciones de la ruta de aprendizaje. El CONTENIDO de las lecciones vive en
--   código (src/lib/curriculum.ts); aquí solo se guarda el PROGRESO. Por eso
--   `lesson_id` es un slug de texto (sin FK a ninguna tabla de lecciones).
--
--   Modelo:
--     auth.users
--       └─ lesson_progress  (1:N: un usuario tiene progreso en muchas lecciones,
--                            único por (user_id, lesson_id))
-- =============================================================================

-- pgcrypto (gen_random_uuid) — normalmente ya activada; se incluye por seguridad.
create extension if not exists "pgcrypto";

create table if not exists public.lesson_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Slug de la lección definido en src/lib/curriculum.ts (no hay FK a propósito).
  lesson_id    text        not null,
  status       text        not null default 'in_progress'
                 check (status in ('not_started', 'in_progress', 'completed')),
  -- Puntaje de quiz (0–100). NULL hasta que exista evaluación (Fase 4 posterior).
  quiz_score   int         check (quiz_score between 0 and 100),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Un único registro de progreso por usuario y lección (permite UPSERT).
  unique (user_id, lesson_id)
);

create index if not exists lesson_progress_user_id_idx
  on public.lesson_progress (user_id);

-- =============================================================================
-- Row Level Security: cada usuario solo ve/gestiona su propio progreso.
-- =============================================================================
alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
create policy "lesson_progress_insert_own"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
create policy "lesson_progress_update_own"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lesson_progress_delete_own" on public.lesson_progress;
create policy "lesson_progress_delete_own"
  on public.lesson_progress for delete
  using (auth.uid() = user_id);
