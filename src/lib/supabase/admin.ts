import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con el ROL DE SERVICIO (`service_role`).
 *
 * ⚠️ SOLO SERVIDOR. Esta clave se salta Row Level Security por completo: nunca
 * debe importarse desde un Client Component ni exponerse al navegador.
 *
 * Existe porque hay dos escrituras que no pueden hacerse con la sesión del
 * usuario:
 *  1. El webhook de Mercado Pago llega SIN sesión (lo invoca Mercado Pago), y
 *     aun así debe marcar la suscripción como activa.
 *  2. Las columnas de suscripción de `profiles` están blindadas por el trigger
 *     `protect_subscription_columns()` (migración 006), que solo acepta cambios
 *     provenientes del rol de servicio. Así un usuario no puede concederse
 *     `subscription_status = 'active'` desde el navegador con la anon key.
 *
 * No persiste sesión: cada petición usa la clave directamente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY: no se puede " +
        "gestionar la suscripción sin el rol de servicio.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
