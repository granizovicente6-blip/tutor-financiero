// =============================================================================
// Analítica — registro simple de eventos (métricas de éxito, Fase 6).
//
// Guarda eventos (lección/quiz completados) en la tabla `analytics_events` para
// medir la tasa de finalización. Es "fire-and-forget" y FAIL-OPEN: si el
// registro falla, se anota en consola pero NUNCA rompe el flujo del usuario.
// =============================================================================

import type { createClient } from "@/lib/supabase/server";
import type { AnalyticsEventType } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Registra un evento del usuario. El `userId` se pasa explícitamente (los
 * llamadores ya lo tienen tras autenticar) para evitar una lectura extra; la
 * política RLS "analytics_events_insert_own" exige que coincida con auth.uid().
 */
export async function logEvent(
  supabase: SupabaseServerClient,
  userId: string,
  type: AnalyticsEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("analytics_events")
    .insert({ user_id: userId, event_type: type, metadata });

  if (error) {
    console.error("[analytics] No se pudo registrar el evento:", type, error);
  }
}
