-- =============================================================================
-- Migración 009 — Nivel financiero POR CATEGORÍA en `profiles`
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   Es IDEMPOTENTE: se puede ejecutar varias veces sin error.
--
-- Contexto
-- --------
-- El Test de Diagnóstico se separó en dos tests independientes, uno por cada
-- categoría del currículum ("Finanzas Personales" e "Inversiones"), porque son
-- competencias que van por separado: se puede llevar un presupuesto impecable
-- sin haber comprado nunca un ETF, y al revés.
--
-- Por eso el perfil pasa a guardar TRES niveles:
--
--   · financial_level            — nivel global. NO cambia de significado: sigue
--                                  siendo el que lee el tutor para decidir cómo
--                                  explicar. Ahora se calcula resumiendo los dos
--                                  niveles por categoría (`combineLevels`).
--   · financial_level_personal   — nivel en Finanzas Personales.
--   · financial_level_investing  — nivel en Inversiones.
--
-- Las dos columnas nuevas admiten NULL: NULL significa "esa categoría todavía no
-- se ha evaluado", que es el estado de todos los usuarios existentes. La app
-- funciona sin esta migración aplicada (ver `lib/financial-level.ts`, que
-- reintenta con `financial_level` a secas si las columnas no existen), así que
-- el despliegue del código y la ejecución de este script no tienen por qué
-- ocurrir en el mismo instante.
-- =============================================================================

-- 1. Columnas (sin constraint todavía; IF NOT EXISTS las hace repetibles).
alter table public.profiles
  add column if not exists financial_level_personal text;

alter table public.profiles
  add column if not exists financial_level_investing text;

-- 2. Constraints CHECK. Se recrean de forma idempotente (drop + add) porque
--    ADD CONSTRAINT no soporta IF NOT EXISTS. NULL pasa el CHECK por defecto.
alter table public.profiles
  drop constraint if exists profiles_financial_level_personal_check;

alter table public.profiles
  add constraint profiles_financial_level_personal_check
  check (financial_level_personal in ('beginner', 'intermediate', 'advanced'));

alter table public.profiles
  drop constraint if exists profiles_financial_level_investing_check;

alter table public.profiles
  add constraint profiles_financial_level_investing_check
  check (financial_level_investing in ('beginner', 'intermediate', 'advanced'));

-- Nota 1: no se hace backfill desde `financial_level`. El nivel antiguo se midió
-- con un test que mezclaba las dos categorías, así que copiarlo a ambas columnas
-- afirmaría algo que nunca se comprobó (y convalidaría módulos de Inversiones
-- con aciertos de presupuesto). Los usuarios existentes quedan en NULL y la
-- primera vez que rindan un test de categoría se les mide de verdad; mientras
-- tanto, su `financial_level` global sigue intacto y el tutor no cambia.
--
-- Nota 2: no hace falta tocar las políticas RLS. La política existente
-- "profiles_update_own" (auth.uid() = id) ya permite que cada usuario actualice
-- sus propias columnas de nivel.
