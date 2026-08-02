-- =============================================================================
-- Migración 008 — Expiración de la racha + corte diario en hora de Chile
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa CREATE OR REPLACE.)
--
-- Arregla dos cosas:
--
-- 1. LA RACHA NO CADUCABA.
--    `touch_streak()` (migración 003) solo corre cuando el usuario COMPLETA
--    algo. Si deja de estudiar, nadie recalcula nada: `current_streak` se queda
--    con el último valor y la app lo pinta encendido para siempre. Se añade
--    `get_streak()`, la lectura oficial, que además EXPIRA la racha de forma
--    perezosa (lazy) cuando la última actividad fue anteayer o antes.
--
-- 2. EL DÍA CORTABA EN UTC.
--    La 003 usaba `current_date` (UTC), así que el día cambiaba a las 20:00 o
--    21:00 hora chilena: quien estudiaba de noche veía la racha saltar antes de
--    tiempo. Ahora ambas funciones usan la fecha en 'America/Santiago', de modo
--    que el corte cae exactamente a las 00:00 de Chile. El cast desde `now()`
--    (timestamptz) resuelve solo el horario de verano.
--
--    OJO: lectura y escritura DEBEN compartir zona. Por eso esta migración
--    reemplaza también `touch_streak()`; si una usara UTC y la otra Chile, una
--    lección completada a las 21:00 se guardaría con la fecha de mañana.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función: app_today()
-- El "hoy" de la aplicación: fecha civil en Chile. Único sitio donde vive la
-- zona horaria, para que no puedan desalinearse las funciones que la usan.
-- STABLE (no IMMUTABLE): depende de now(), que es fijo dentro de la transacción.
-- -----------------------------------------------------------------------------
create or replace function public.app_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Santiago')::date;
$$;

-- -----------------------------------------------------------------------------
-- Función: touch_streak()  [reemplaza la versión UTC de la migración 003]
-- Registra actividad del usuario autenticado HOY (hora de Chile) y devuelve la
-- racha resultante.
--   - last_active_date = hoy      -> sin cambios (idempotente en el mismo día)
--   - last_active_date = ayer     -> current_streak + 1 (racha continúa)
--   - más antigua o NULL          -> current_streak = 1 (racha empieza/reinicia)
-- Corre con la identidad del usuario (auth.uid()); la política RLS
-- "profiles_update_own" garantiza que solo actualiza su propio perfil.
-- -----------------------------------------------------------------------------
create or replace function public.touch_streak()
returns table (current_streak int, longest_streak int, last_active_date date)
language plpgsql
as $$
declare
  v_today   date := public.app_today();
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

  if v_last = v_today then
    -- Ya contó hoy: mantenemos el valor actual.
    null;
  elsif v_last = v_today - 1 then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.profiles p
     set current_streak   = v_current,
         longest_streak   = v_longest,
         last_active_date = v_today
   where p.id = auth.uid();

  return query select v_current, v_longest, v_today;
end;
$$;

-- -----------------------------------------------------------------------------
-- Función: get_streak()
-- Devuelve la racha ya validada del usuario autenticado y persiste el reinicio
-- si expiró. Corre con la identidad del usuario (auth.uid()); las políticas RLS
-- "profiles_select_own"/"profiles_update_own" acotan la fila a la suya.
--   - last_active_date = hoy   -> racha viva, ya cumplida hoy (active_today)
--   - last_active_date = ayer  -> racha viva, pendiente de hoy
--   - más antigua o NULL       -> current_streak = 0 (racha rota)
-- `longest_streak` nunca se toca: es el récord histórico.
--
-- `active_today` distingue los dos estados de una racha viva, que la UI pinta
-- distinto: ya completada hoy (🔥 encendida) vs. pendiente de hoy (en riesgo).
-- -----------------------------------------------------------------------------
create or replace function public.get_streak()
returns table (
  current_streak   int,
  longest_streak   int,
  last_active_date date,
  active_today     boolean
)
language plpgsql
as $$
declare
  v_today   date := public.app_today();
  v_last    date;
  v_current int;
  v_longest int;
begin
  select p.last_active_date, coalesce(p.current_streak, 0), coalesce(p.longest_streak, 0)
    into v_last, v_current, v_longest
  from public.profiles p
  where p.id = auth.uid();

  -- Sin fila de perfil (o sin sesión): no hay racha que devolver.
  if not found then
    return;
  end if;

  -- Expiración: nunca hubo actividad, o la última fue anteayer o antes.
  -- (Ayer sigue siendo válido: la racha está viva, esperando la de hoy.)
  if v_last is null or v_last < v_today - 1 then
    if v_current <> 0 then
      update public.profiles p
         set current_streak = 0
       where p.id = auth.uid();
    end if;
    v_current := 0;
  end if;

  -- coalesce: con last_active_date NULL la comparación da NULL, no false.
  return query select v_current, v_longest, v_last, coalesce(v_last = v_today, false);
end;
$$;
