-- =============================================================================
-- Migración 008 — Límite de peticiones de datos de mercado
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: CREATE OR REPLACE de la función de las migraciones 004/007.)
--
-- Qué hace:
--   Añade `/api/market/quote` a los topes por ruta de check_rate_limit() con un
--   límite de 30 peticiones por minuto.
--
--   El tope es más alto que el del análisis con IA (10/min) porque no cuesta
--   tokens y una misma ficha dispara varias consultas legítimas: al abrirla y
--   una más por cada rango del gráfico que el estudiante pruebe. Lo que protege
--   es la cuota del proveedor de datos, ya amortiguada por el caché en memoria
--   de `lib/market.ts`.
--
--   Aplicarla es OPCIONAL: 30/min coincide con el valor por defecto, así que sin
--   ella el comportamiento es el mismo. Se declara explícitamente para que el
--   tope de esta ruta quede documentado y se pueda ajustar sin adivinar.
--
--   El resto de la función es idéntico a la migración 007: solo cambia el CASE
--   de los límites. Se reescribe entera porque PostgreSQL no permite parchear
--   el cuerpo de una función.
--
--   IMPORTANTE: incluye también los topes de las migraciones 004 y 007, así que
--   aplicar esta sola deja la función completa y al día.
-- =============================================================================

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
    when '/api/chat'                 then 15
    when '/api/quiz/feedback'        then 10
    when '/api/instruments/analyze'  then 10
    when '/api/market/quote'         then 30
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
