// =============================================================================
// Mercado Pago — configuración del SDK y helpers (Fase 7)
//
// ⚠️ SOLO SERVIDOR: `MERCADOPAGO_ACCESS_TOKEN` permite cobrar en nombre de la
// cuenta, así que este módulo nunca debe importarse desde un Client Component.
// La única credencial pública (`NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`) se expone
// aparte en `getPublicKey()`.
// =============================================================================

import { MercadoPagoConfig, PreApproval } from "mercadopago";

/** Tiempo máximo de espera de una llamada a la API de Mercado Pago (ms). */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Configuración del SDK con el access token del entorno.
 * Lanza si falta la credencial: es un error de despliegue, no del usuario.
 */
export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "Falta MERCADOPAGO_ACCESS_TOKEN: no se puede operar con Mercado Pago.",
    );
  }

  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: REQUEST_TIMEOUT_MS },
  });
}

/** Cliente de suscripciones (preapproval) listo para usar. */
export function getPreApprovalClient(): PreApproval {
  return new PreApproval(getMercadoPagoConfig());
}

/**
 * True si las credenciales configuradas son de PRUEBA (`TEST-...`).
 * Sirve para avisar en la UI de que no se cobrará dinero real.
 */
export function isTestMode(): boolean {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-");
}

/** Public key de Mercado Pago (pública por diseño; puede ir al navegador). */
export function getPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? null;
}

/**
 * URL pública del sitio, para construir la `back_url` del checkout.
 *
 * Orden de resolución:
 *  1. `NEXT_PUBLIC_SITE_URL` (explícita; la que manda).
 *  2. `VERCEL_URL` (la inyecta Vercel en cada despliegue, sin protocolo).
 *  3. `http://localhost:3000` para desarrollo local.
 *
 * Nunca se deriva de la cabecera `Host` de la petición: es controlable por el
 * cliente y acabaría en una `back_url` apuntando a un dominio ajeno.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Estados de Mercado Pago -> estados de la app
// ---------------------------------------------------------------------------

/**
 * Estados de una suscripción (preapproval) en Mercado Pago:
 *   `pending`    — creada, el usuario aún no la autorizó en el checkout.
 *   `authorized` — autorizada y cobrando: es la única que da acceso.
 *   `paused`     — pausada (p. ej. tras fallar el cobro).
 *   `cancelled`  — cancelada definitivamente.
 */
export type MercadoPagoPreapprovalStatus =
  | "pending"
  | "authorized"
  | "paused"
  | "cancelled";

/**
 * Traduce el estado de Mercado Pago al de la app.
 * `paused` se trata como 'cancelled': el cobro no está al día, así que se
 * mantiene el acceso solo hasta el fin del período pagado.
 */
export function toSubscriptionStatus(
  mpStatus: string | undefined,
): "active" | "cancelled" | "pending" {
  switch (mpStatus) {
    case "authorized":
      return "active";
    case "paused":
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
