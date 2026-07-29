-- =============================================================================
-- Migración 001 — Añadir `financial_level` a `profiles` (Fase 4)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   Es IDEMPOTENTE: se puede ejecutar varias veces sin error.
--
-- Añade el nivel de conocimiento financiero del estudiante para que el tutor
-- adapte su pedagogía. Valores permitidos: 'beginner' | 'intermediate' |
-- 'advanced'. Se permite NULL (nivel aún no definido).
-- =============================================================================

-- 1. Columna (sin constraint todavía; IF NOT EXISTS la hace repetible).
alter table public.profiles
  add column if not exists financial_level text;

-- 2. Constraint CHECK. Se recrea de forma idempotente (drop + add) porque
--    ADD CONSTRAINT no soporta IF NOT EXISTS. NULL pasa el CHECK por defecto.
alter table public.profiles
  drop constraint if exists profiles_financial_level_check;

alter table public.profiles
  add constraint profiles_financial_level_check
  check (financial_level in ('beginner', 'intermediate', 'advanced'));

-- Nota: no hace falta tocar las políticas RLS. La política existente
-- "profiles_update_own" (auth.uid() = id) ya permite que cada usuario
-- actualice su propio financial_level.
