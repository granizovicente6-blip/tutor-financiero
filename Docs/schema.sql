-- =============================================================================
-- Esquema de base de datos — Plataforma de Educación Financiera (Fases 3–4)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarlo:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / DROP POLICY IF EXISTS.)
--
-- Modelo de datos:
--   auth.users (gestionado por Supabase Auth)
--     └─ profiles        (1:1 con el usuario)
--     │  └─ conversations (1:N: un usuario tiene muchas conversaciones)
--     │     └─ messages    (1:N: una conversación tiene muchos mensajes)
--     └─ lesson_progress  (1:N: progreso del usuario por lección, Fase 4)
--
-- Seguridad: Row Level Security (RLS) activado en todas las tablas, de modo
-- que cada usuario SOLO puede acceder a sus propios datos.
-- =============================================================================

-- Extensión para generar UUIDs (gen_random_uuid). En Supabase suele venir
-- activada; la incluimos por seguridad.
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabla: profiles
-- Perfil del estudiante. La PK es el id del usuario en auth.users (relación 1:1).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid        primary key references auth.users (id) on delete cascade,
  email            text,
  -- Nivel de conocimiento financiero GLOBAL (Fase 4). Es el que lee el tutor.
  -- NULL = aún no definido. Resume los dos niveles por categoría de más abajo.
  financial_level  text        check (financial_level in ('beginner', 'intermediate', 'advanced')),
  -- Nivel por categoría del currículum (migración 009): el Test de Diagnóstico
  -- se rinde por separado para Finanzas Personales y para Inversiones, y cada
  -- uno convalida módulos solo de su categoría. NULL = categoría aún no medida.
  financial_level_personal  text
                 check (financial_level_personal in ('beginner', 'intermediate', 'advanced')),
  financial_level_investing text
                 check (financial_level_investing in ('beginner', 'intermediate', 'advanced')),
  -- Racha de estudio (Fase 5). Se actualizan vía la función touch_streak().
  current_streak   int         not null default 0,
  longest_streak   int         not null default 0,
  last_active_date date,
  -- Suscripción de Mercado Pago (Fase 7). Los nuevos usuarios entran en 'free'
  -- por el DEFAULT: handle_new_user() solo inserta (id, email).
  subscription_status text     not null default 'free'
                 check (subscription_status in ('free', 'active', 'cancelled', 'pending')),
  -- ID de la suscripción (preapproval) en Mercado Pago: clave de conciliación
  -- del webhook, que no tiene sesión de usuario.
  mp_preapproval_id  text,
  mp_payer_id        text,
  -- Fin del período ya pagado (el acceso se mantiene hasta esa fecha).
  current_period_end timestamptz,
  created_at       timestamptz not null default now()
);

-- Búsqueda por preapproval_id desde el webhook.
create unique index if not exists profiles_mp_preapproval_id_idx
  on public.profiles (mp_preapproval_id)
  where mp_preapproval_id is not null;

-- -----------------------------------------------------------------------------
-- Tabla: conversations
-- Cada sesión de chat del usuario con el tutor de IA (ChatSessions en el ARCH).
-- -----------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx
  on public.conversations (user_id);

-- -----------------------------------------------------------------------------
-- Tabla: messages
-- Historial de mensajes de una conversación (ChatMessages en el ARCH).
-- role se restringe a 'user' | 'assistant' para coincidir con la API/UI.
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id);

-- -----------------------------------------------------------------------------
-- Tabla: lesson_progress (Fase 4)
-- Avance del estudiante en la ruta de aprendizaje. El CONTENIDO de las lecciones
-- vive en código (src/lib/curriculum.ts); aquí solo se guarda el PROGRESO, por
-- lo que `lesson_id` es un slug de texto (sin FK a propósito).
-- -----------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  lesson_id    text        not null,
  status       text        not null default 'in_progress'
                 check (status in ('not_started', 'in_progress', 'completed')),
  quiz_score   int         check (quiz_score between 0 and 100),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists lesson_progress_user_id_idx
  on public.lesson_progress (user_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
alter table public.profiles        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.lesson_progress enable row level security;

-- --- profiles: el usuario solo ve/gestiona su propio perfil --------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- --- profiles: las columnas de suscripción solo las gestiona el servidor -------
-- "profiles_update_own" no distingue columnas, así que sin este trigger un
-- usuario podría escribir subscription_status = 'active' desde el navegador y
-- saltarse el muro de pago. Los cambios que no vengan del rol de servicio (o de
-- un administrador de la BD) se revierten en silencio. Ver migración 006.
create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  v_jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';

  if v_jwt_role = 'service_role'
     or current_user in ('service_role', 'postgres', 'supabase_admin')
  then
    return new;
  end if;

  new.subscription_status := old.subscription_status;
  new.mp_preapproval_id   := old.mp_preapproval_id;
  new.mp_payer_id         := old.mp_payer_id;
  new.current_period_end  := old.current_period_end;
  return new;
end;
$$;

drop trigger if exists profiles_protect_subscription on public.profiles;
create trigger profiles_protect_subscription
  before update on public.profiles
  for each row execute function public.protect_subscription_columns();

-- --- conversations: el usuario solo accede a sus propias conversaciones ---------
drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
  on public.conversations for select
  using (auth.uid() = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
  on public.conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
  on public.conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- --- messages: acceso solo si la conversación padre es del usuario --------------
-- (messages no tiene user_id directo; se valida a través de conversations.)
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- --- lesson_progress: el usuario solo ve/gestiona su propio progreso -----------
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

-- =============================================================================
-- Trigger: crear el perfil automáticamente al registrarse un usuario
-- Cuando Supabase Auth inserta una fila en auth.users, se crea su profile.
-- SECURITY DEFINER permite el insert saltando RLS de forma controlada.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Función: app_today() (migración 008)
-- El "hoy" de la aplicación: fecha civil en Chile. Único sitio donde vive la
-- zona horaria, para que las funciones de racha no puedan desalinearse. El cast
-- desde now() (timestamptz) resuelve solo el horario de verano.
-- STABLE (no IMMUTABLE): depende de now(), fijo dentro de la transacción.
-- =============================================================================
create or replace function public.app_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Santiago')::date;
$$;

-- =============================================================================
-- Función: touch_streak() (Fase 5, zona horaria en migración 008)
-- Registra un "día activo" del usuario autenticado y recalcula su racha de
-- estudio de forma atómica. Devuelve la racha resultante. Frontera del día:
-- 00:00 hora de Chile (app_today()).
--   - last_active_date = hoy  -> sin cambios (idempotente en el mismo día)
--   - last_active_date = ayer -> current_streak + 1 (racha continúa)
--   - más antiguo o NULL      -> current_streak = 1 (racha empieza/reinicia)
-- =============================================================================
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

  if not found then
    return;
  end if;

  if v_last = v_today then
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

-- =============================================================================
-- Función: get_streak() (Fase 5, migración 008)
-- La lectura oficial de la racha. touch_streak() solo corre cuando el usuario
-- completa algo; si deja de estudiar, nadie recalcularía nada y la racha se
-- quedaría encendida para siempre. Por eso esta función también la EXPIRA de
-- forma perezosa. Frontera del día: 00:00 hora de Chile (app_today()).
--   - last_active_date = hoy   -> racha viva, ya cumplida hoy (active_today)
--   - last_active_date = ayer  -> racha viva, pendiente de hoy
--   - más antigua o NULL       -> current_streak = 0 (racha rota)
-- longest_streak nunca se toca: es el récord histórico.
-- =============================================================================
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

  if not found then
    return;
  end if;

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

-- =============================================================================
-- Rate limiting por usuario (Fase 6)
-- Ventana fija por minuto y por ruta. Los límites van dentro de la función
-- (no como parámetro) para que el cliente no pueda saltarse el tope.
-- =============================================================================
create table if not exists public.api_rate_limits (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  route        text        not null,
  window_start timestamptz not null default now(),
  count        int         not null default 0,
  primary key (user_id, route)
);

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
  v_limit := case p_route
    when '/api/chat'          then 15
    when '/api/quiz/feedback' then 10
    else 30
  end;

  insert into public.api_rate_limits (user_id, route, window_start, count)
  values (auth.uid(), p_route, v_now, 0)
  on conflict (user_id, route) do nothing;

  select r.window_start, r.count
    into v_start, v_count
  from public.api_rate_limits r
  where r.user_id = auth.uid() and r.route = p_route
  for update;

  if v_start is null or v_now - v_start >= make_interval(secs => v_window_secs) then
    update public.api_rate_limits
       set window_start = v_now, count = 1
     where user_id = auth.uid() and route = p_route;
    return query select true, 0, v_limit, v_limit - 1;
    return;
  end if;

  if v_count < v_limit then
    update public.api_rate_limits
       set count = v_count + 1
     where user_id = auth.uid() and route = p_route;
    return query select true, 0, v_limit, v_limit - (v_count + 1);
    return;
  end if;

  return query
    select
      false,
      greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window_secs) - v_now)))::int),
      v_limit,
      0;
end;
$$;

-- =============================================================================
-- Eventos de analítica (métricas de éxito) (Fase 6)
-- Registro simple de eventos (lección/quiz completados) para medir la tasa de
-- finalización. Metadatos flexibles en JSONB.
-- =============================================================================
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

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_select_own" on public.analytics_events;
create policy "analytics_events_select_own"
  on public.analytics_events for select
  using (auth.uid() = user_id);

drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);
