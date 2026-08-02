// =============================================================================
// Suscripción Premium — dominio compartido (Fase 7)
//
// Aquí vive TODO lo que la app necesita saber de la suscripción sin depender de
// Mercado Pago: el precio del plan, qué estados dan acceso y cómo leer/escribir
// el estado del usuario. La integración concreta con la pasarela está en
// `lib/mercadopago.ts`, de modo que cambiar de proveedor no toque el muro de pago.
// =============================================================================

import type { createClient } from "@/lib/supabase/server";
import type { SubscriptionInfo, SubscriptionStatus } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// El plan
// ---------------------------------------------------------------------------

/**
 * Plan Premium mensual. El importe se cobra en pesos chilenos, que no tienen
 * decimales: el monto va como entero (4990 = $4.990 CLP).
 *
 * Este es el ÚNICO sitio donde vive el precio: la landing, la página de precios
 * y el `auto_recurring.transaction_amount` que se envía a Mercado Pago lo leen
 * de aquí, de modo que no puedan desalinearse.
 */
export const PREMIUM_PLAN = {
  /** Nombre mostrado en la UI y enviado a Mercado Pago como `reason`. */
  name: "Tutor Financiero Premium",
  amount: 4990,
  currencyId: "CLP",
  /** Se cobra 1 vez cada `frequencyType`. */
  frequency: 1,
  frequencyType: "months",
} as const;

/** Precio formateado para la UI ("$4.990"). */
export function formatPlanPrice(amount: number = PREMIUM_PLAN.amount): string {
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(amount)}`;
}

// ---------------------------------------------------------------------------
// Reglas de acceso
// ---------------------------------------------------------------------------

/**
 * True si el usuario tiene acceso al contenido completo.
 *
 * Solo 'active' abre las 86 lecciones. 'pending' (checkout iniciado pero sin
 * confirmar) NO da acceso: se concede al recibir la confirmación de pago en el
 * webhook, nunca al volver del checkout, porque esa vuelta la controla el
 * navegador del usuario y es falsificable.
 *
 * `cancelled` conserva el acceso hasta que termine el período ya pagado
 * (`current_period_end`): el usuario pagó ese mes completo.
 */
export function hasPremiumAccess(subscription: SubscriptionInfo): boolean {
  if (subscription.status === "active") return true;

  if (subscription.status === "cancelled" && subscription.currentPeriodEnd) {
    return new Date(subscription.currentPeriodEnd).getTime() > Date.now();
  }

  return false;
}

/** Suscripción por defecto (usuario sin fila de perfil o con lectura fallida). */
export const FREE_SUBSCRIPTION: SubscriptionInfo = {
  status: "free",
  preapprovalId: null,
  currentPeriodEnd: null,
};

// ---------------------------------------------------------------------------
// Lectura del estado
// ---------------------------------------------------------------------------

/**
 * Lee la suscripción del usuario autenticado desde `profiles`.
 *
 * FAIL-CLOSED: ante cualquier error o perfil inexistente devuelve 'free'. Si la
 * base de datos falla, lo correcto es mostrar el muro de pago, no regalar el
 * contenido de pago.
 */
export async function getSubscription(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SubscriptionInfo> {
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_status, mp_preapproval_id, current_period_end")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[subscription] No se pudo leer el estado de suscripción:", error);
    return FREE_SUBSCRIPTION;
  }
  if (!data) return FREE_SUBSCRIPTION;

  return {
    status: normalizeStatus(data.subscription_status),
    preapprovalId: (data.mp_preapproval_id as string | null) ?? null,
    currentPeriodEnd: (data.current_period_end as string | null) ?? null,
  };
}

/** Valida el valor leído de la BD contra los estados conocidos. */
export function normalizeStatus(value: unknown): SubscriptionStatus {
  return value === "active" || value === "cancelled" || value === "pending"
    ? value
    : "free";
}
