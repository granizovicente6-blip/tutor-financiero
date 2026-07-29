-- =============================================================================
-- Migración 004 — Rate Limiting por usuario (Fase 6)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / CREATE OR REPLACE.)
--
-- Qué hace:
--   Limita las peticiones por usuario y por ruta de API mediante una VENTANA
--   FIJA por minuto, calculada de forma atómica en la función check_rate_limit().
--   Objetivo: proteger el gasto de la API de IA (sobre todo /api/chat).
--
--   Los límites están HARDCODEADOS dentro de la función (no son parámetros) para
--   que un cliente no pueda invocarla con un límite arbitrario y saltarse el tope.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabla: api_rate_limits
-- Una fila por (usuario, ruta): contador de la ventana actual.
-- -----------------------------------------------------------------------------
create table if not exists public.api_rate_limits (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  route        text        not null,
  window_start timestamptz not null default now(),
  count        int         not null default 0,
  primary key (user_id, route)
);

-- =============================================================================
-- Row Level Security: cada usuario solo puede tocar sus propios contadores.
-- =============================================================================
alter table public.api_rate_limits enable row level security;

drop policy if exists "api_rate_limits_select_own" on public.api_rate_limits;
create policy "api_rate_limits_select_own"
  on public.api_rate_limits for select
  using (auth.uid() = user_id);

drop policy if exists "api_rate_limits_insert_own" on public.api_rate_limits;
create policy "api_rate_limits_insert_own"
  on public.api_rate_limits for insert
  with check (auth.uid() = user_id);

drop policy if exists "api_rate_limits_update_own" on public.api_rate_limits;
create policy "api_rate_limits_update_own"
  on public.api_rate_limits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Función: check_rate_limit(p_route)
-- Registra una petición del usuario autenticado a la ruta indicada y decide si
-- se permite, aplicando una ventana fija por minuto. Devuelve:
--   allowed     -> true si la petición está dentro del límite
--   retry_after -> segundos hasta que se reinicie la ventana (si se bloqueó)
--   limit_value -> tope de la ventana (informativo)
--   remaining   -> peticiones restantes en la ventana
--
-- Límites por ruta (hardcodeados): /api/chat = 15/min, /api/quiz/feedback = 10/min.
-- Rutas no listadas usan un tope por defecto de 30/min.
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_route text)
returns table (allowed boolean, retry_after int, limit_value int, remaining int)
language plpgsql
as $$
declare
  v_limit       int;
  v_window_secs constant int := 60;
  v_now         timestamptz := now();
  v_start       timestamptz;
  v_count       int;
begin
  -- Tope según la ruta (no depende del cliente).
  v_limit := case p_route
    when '/api/chat'          then 15
    when '/api/quiz/feedback' then 10
    else 30
  end;

  -- Bloquea/crea la fila del usuario+ruta para evitar carreras.
  insert into public.api_rate_limits (user_id, route, window_start, count)
  values (auth.uid(), p_route, v_now, 0)
  on conflict (user_id, route) do nothing;

  select r.window_start, r.count
    into v_start, v_count
  from public.api_rate_limits r
  where r.user_id = auth.uid() and r.route = p_route
  for update;

  -- ¿Ventana expirada? -> reiniciar.
  if v_start is null or v_now - v_start >= make_interval(secs => v_window_secs) then
    update public.api_rate_limits
       set window_start = v_now, count = 1
     where user_id = auth.uid() and route = p_route;
    return query select true, 0, v_limit, v_limit - 1;
    return;
  end if;

  -- Dentro de la ventana: ¿queda cupo?
  if v_count < v_limit then
    update public.api_rate_limits
       set count = v_count + 1
     where user_id = auth.uid() and route = p_route;
    return query select true, 0, v_limit, v_limit - (v_count + 1);
    return;
  end if;

  -- Límite alcanzado: bloquear e indicar cuándo reintentar.
  return query
    select
      false,
      greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window_secs) - v_now)))::int),
      v_limit,
      0;
end;
$$;
