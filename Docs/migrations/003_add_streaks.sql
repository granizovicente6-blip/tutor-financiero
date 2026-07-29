-- =============================================================================
-- Migración 003 — Racha de estudio (streaks) (Fase 5)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / CREATE OR REPLACE.)
--
-- Qué hace:
--   1. Añade a `profiles` las columnas de racha (dato 1:1 por usuario).
--   2. Crea la función atómica `touch_streak()`, que registra un "día activo"
--      y recalcula la racha en una sola operación (evita condiciones de carrera
--      del patrón leer-modificar-escribir desde la app).
--
--   Frontera del "día": current_date del servidor (UTC). Es una simplificación
--   consciente para el MVP (usuarios en otras zonas horarias verían el corte a
--   una hora distinta).
-- =============================================================================

alter table public.profiles
  add column if not exists current_streak   int  not null default 0;

alter table public.profiles
  add column if not exists longest_streak    int  not null default 0;

alter table public.profiles
  add column if not exists last_active_date  date;

-- -----------------------------------------------------------------------------
-- Función: touch_streak()
-- Registra actividad del usuario autenticado HOY y devuelve la racha resultante.
--   - last_active_date = hoy      -> sin cambios (idempotente en el mismo día)
--   - last_active_date = ayer     -> current_streak + 1 (racha continúa)
--   - más antiguo o NULL          -> current_streak = 1 (racha empieza/reinicia)
-- Corre con la identidad del usuario (auth.uid()); la política RLS
-- "profiles_update_own" garantiza que solo actualiza su propio perfil.
-- -----------------------------------------------------------------------------
create or replace function public.touch_streak()
returns table (current_streak int, longest_streak int, last_active_date date)
language plpgsql
as $$
declare
  v_last    date;
  v_current int;
  v_longest int;
begin
  select p.last_active_date, coalesce(p.current_streak, 0), coalesce(p.longest_streak, 0)
    into v_last, v_current, v_longest
  from public.profiles p
  where p.id = auth.uid();

  -- Sin fila de perfil (no debería ocurrir): no hay nada que actualizar.
  if not found then
    return;
  end if;

  if v_last = current_date then
    -- Ya contó hoy: mantenemos el valor actual.
    null;
  elsif v_last = current_date - 1 then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.profiles p
     set current_streak   = v_current,
         longest_streak   = v_longest,
         last_active_date = current_date
   where p.id = auth.uid();

  return query select v_current, v_longest, current_date;
end;
$$;
