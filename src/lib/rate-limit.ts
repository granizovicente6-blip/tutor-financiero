// =============================================================================
// Rate limiting por usuario — helper de servidor (Fase 6).
//
// Envuelve la función RPC atómica `check_rate_limit(p_route)` (ver migración
// 004). Los topes viven en la BD, no aquí, para que el cliente no pueda alterarlos.
//
// Estrategia ante fallos: FAIL-OPEN. Si el limitador falla (p. ej. la migración
// aún no se aplicó), se registra y se permite la petición, para no romper la UX
// por una caída del limitador.
// =============================================================================

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Rutas de API sujetas a rate limiting (deben coincidir con la función SQL).
 * Las que no estén listadas en `check_rate_limit` usan el tope por defecto
 * (30/min), suficiente para la creación de suscripciones.
 */
export const API_ROUTES = {
  chat: "/api/chat",
  quizFeedback: "/api/quiz/feedback",
  createSubscription: "/api/mercadopago/create-subscription",
  instrumentAnalysis: "/api/instruments/analyze",
} as const;

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos hasta que se reinicie la ventana (0 si se permitió). */
  retryAfter: number;
}

/**
 * Registra una petición del usuario autenticado a `route` y devuelve si está
 * permitida. Debe llamarse DESPUÉS de autenticar (usa auth.uid() en la BD).
 */
export async function enforceRateLimit(
  supabase: SupabaseServerClient,
  route: string,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", { p_route: route });

  if (error) {
    console.error("[rate-limit] Fallo al comprobar el límite (fail-open):", error);
    return { allowed: true, retryAfter: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { allowed: true, retryAfter: 0 };
  }

  return {
    allowed: Boolean(row.allowed),
    retryAfter: Number(row.retry_after ?? 0),
  };
}

/** Respuesta HTTP 429 estándar con cabecera Retry-After. */
export function rateLimitedResponse(retryAfter: number): Response {
  return Response.json(
    {
      error:
        "Has alcanzado el límite de solicitudes. Espera unos segundos e inténtalo de nuevo.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfter)) },
    },
  );
}
