-- =============================================================================
-- Migración 006 — Suscripciones con Mercado Pago (Fase 7)
-- Motor: PostgreSQL (Supabase)
--
-- Cómo aplicarla:
--   Supabase Dashboard -> SQL Editor -> pega este archivo -> "Run".
--   (Es idempotente: usa IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.)
--
-- Qué hace:
--   1. Añade a `profiles` el estado de suscripción y los identificadores de
--      Mercado Pago necesarios para conciliar los webhooks con el usuario.
--   2. BLINDA esas columnas: como la política RLS "profiles_update_own" permite
--      que cada usuario actualice su propio perfil desde el navegador (con la
--      anon key), sin esta protección cualquiera podría escribir
--      `subscription_status = 'active'` y saltarse el muro de pago. Un trigger
--      revierte cualquier intento que no venga del rol de servicio.
--
--   Los nuevos usuarios quedan en 'free' automáticamente: la columna es
--   NOT NULL DEFAULT 'free' y el trigger `handle_new_user()` inserta solo
--   (id, email), de modo que el default se aplica solo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnas de suscripción en `profiles`
-- -----------------------------------------------------------------------------

-- Estado de la suscripción del usuario:
--   'free'      -> sin suscripción (acceso al contenido gratuito)
--   'pending'   -> checkout iniciado, aún sin confirmación de Mercado Pago
--   'active'    -> suscripción autorizada y al día (acceso completo)
--   'cancelled' -> suscripción cancelada o con pago fallido (vuelve al gratuito)
alter table public.profiles
  add column if not exists subscription_status text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('free', 'active', 'cancelled', 'pending'));

-- ID de la suscripción (preapproval) en Mercado Pago. Es la clave con la que se
-- concilian las notificaciones del webhook.
alter table public.profiles
  add column if not exists mp_preapproval_id text;

-- ID del pagador (payer) en Mercado Pago. Informativo/soporte: permite ubicar al
-- usuario en el panel de Mercado Pago.
alter table public.profiles
  add column if not exists mp_payer_id text;

-- Fin del período pagado. Mientras no llegue esa fecha el acceso se mantiene aun
-- si la suscripción se cancela (el usuario ya pagó ese mes).
alter table public.profiles
  add column if not exists current_period_end timestamptz;

-- Búsqueda por preapproval_id desde el webhook (no hay sesión de usuario ahí).
create unique index if not exists profiles_mp_preapproval_id_idx
  on public.profiles (mp_preapproval_id)
  where mp_preapproval_id is not null;

-- Normaliza filas creadas antes de esta migración (por si quedó algún NULL).
update public.profiles
   set subscription_status = 'free'
 where subscription_status is null;

-- =============================================================================
-- 2. Blindaje de las columnas de suscripción
--
-- La política RLS "profiles_update_own" es correcta para `financial_level` y las
-- rachas, pero no distingue columnas: cualquier usuario podría hacer
--   supabase.from('profiles').update({ subscription_status: 'active' })
-- desde el navegador. Este trigger BEFORE UPDATE descarta silenciosamente los
-- cambios a las columnas de suscripción salvo que la conexión use el rol de
-- servicio (webhook / rutas de API del servidor) o sea un administrador de la BD.
--
-- Se descarta en silencio en vez de lanzar error para no romper los updates
-- legítimos del propio perfil que viajen en la misma sentencia.
-- =============================================================================
create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  -- Rol declarado en el JWT de PostgREST (NULL fuera de una petición HTTP).
  v_jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';

  -- El rol de servicio (SUPABASE_SERVICE_ROLE_KEY) y los administradores de la
  -- base de datos sí pueden gestionar la suscripción.
  if v_jwt_role = 'service_role'
     or current_user in ('service_role', 'postgres', 'supabase_admin')
  then
    return new;
  end if;

  -- Cualquier otro origen (anon / authenticated): se conservan los valores
  -- antiguos, como si el UPDATE no hubiera tocado estas columnas.
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

-- Nota: el INSERT no necesita protección equivalente. El perfil lo crea siempre
-- `handle_new_user()` (SECURITY DEFINER) sin tocar estas columnas, y la política
-- "profiles_insert_own" exige auth.uid() = id, así que un usuario solo podría
-- auto-insertarse un perfil que ya existe (el ON CONFLICT lo hace inocuo).
