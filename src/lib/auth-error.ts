// =============================================================================
// Lectura de los errores de Supabase Auth — dominio compartido
//
// El SDK entrega los fallos de forma poco fiable y las dos Server Actions de
// autenticación tienen que interpretarlos igual, así que la lectura vive aquí.
//
// El caso que motivó el módulo: un registro que devolvía
// `AuthRetryableFetchError` con `status: 500`. El nombre sugiere un fallo de
// red, pero un 500 solo puede venir de una respuesta HTTP que SÍ llegó —un
// corte real trae `status: 0`—, así que el problema estaba en el servidor de
// Auth (el trigger que crea el perfil), no en la conexión. Decirle al usuario
// "reintenta en un momento" ante un 500 lo manda a repetir algo que va a fallar
// igual: por eso la distinción se hace por el STATUS y no por el nombre.
// =============================================================================

import type { AuthError } from "@supabase/supabase-js";

/**
 * Códigos que sí justifican reintentar: el servidor no llegó a atender la
 * petición (pasarela caída, servicio no disponible, timeout aguas arriba).
 * El 500 queda fuera a propósito —significa que se atendió y reventó dentro—,
 * y también el 501, que no es transitorio.
 */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/** Mensaje único para los fallos de conexión, igual en login y en registro. */
export const CONNECTION_ERROR_MESSAGE =
  "Error de conexión con el servicio de autenticación. Por favor reintenta en un momento.";

/**
 * True si la petición no llegó a completarse o el servicio estaba caído.
 *
 * Con un status utilizable manda el status. Sin él (`0` o ausente) es que el
 * `fetch` falló antes de recibir respuesta, y ahí sí vale mirar el nombre.
 */
export function isConnectionError(error: AuthError): boolean {
  if (typeof error.status === "number" && error.status > 0) {
    return TRANSIENT_STATUSES.has(error.status);
  }

  const hint = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase();
  return hint.includes("retryable") || hint.includes("fetch") || hint.includes("network");
}

/**
 * True si el fallo es del lado de Supabase y no de lo que escribió el usuario:
 * cualquier 5xx que no sea transitorio, o los motivos que GoTrue sí nombra
 * (el trigger de la base de datos, el envío del correo).
 */
export function isServerFault(error: AuthError): boolean {
  if (typeof error.status === "number" && error.status >= 500) return true;

  const hint = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    hint.includes("unexpected_failure") ||
    hint.includes("database error") ||
    hint.includes("error sending")
  );
}

/**
 * Saca un texto utilizable del error.
 *
 * `error.message` no siempre trae algo legible: cuando el servidor responde con
 * un cuerpo de error vacío, el SDK guarda ahí el literal "{}" —el
 * `JSON.stringify` del cuerpo— y eso acabó saliendo en pantalla. Por eso los
 * descartes son por CONTENIDO y no por si el campo existe: `message ?? name`
 * no habría arreglado nada, porque "{}" es un valor perfectamente truthy.
 */
export function describeAuthError(error: AuthError): string {
  const useless = new Set(["", "{}", "[]", "null", "undefined", "[object object]"]);

  for (const candidate of [error.message, error.name]) {
    const text = candidate?.trim();
    if (text && !useless.has(text.toLowerCase())) return text;
  }

  const parts: string[] = [];
  if (error.code) parts.push(`código ${error.code}`);
  if (error.status) parts.push(`HTTP ${error.status}`);
  return parts.length > 0 ? parts.join(", ") : "el servidor no devolvió detalles";
}

/**
 * Objeto que se manda a `console.error` (Vercel -> Logs).
 *
 * `getOwnPropertyNames` es lo que hace visible el error: en un `Error`,
 * `message` y `stack` no son enumerables, así que un `JSON.stringify` normal
 * los deja fuera y el log sale como "{}" —justo el problema que se investigaba.
 */
export function authErrorLogDetail(error: AuthError) {
  return {
    message: error.message,
    name: error.name,
    code: error.code,
    status: error.status,
    raw: JSON.stringify(error, Object.getOwnPropertyNames(error)),
  };
}
