// =============================================================================
// Acceso y redirección post-login — dominio compartido
//
// Una sola fuente para dos preguntas que se hacen en muchos sitios:
//  1. ¿Esta ruta exige sesión? (middleware + guardas de cada página)
//  2. ¿A dónde mando al usuario después de autenticarse?
//
// El modelo es "guest-first": todo es público salvo lo que aparezca en
// PROTECTED_PREFIXES. Así, añadir una página informativa no obliga a tocar la
// lista de excepciones del middleware.
// =============================================================================

/**
 * Prefijos de ruta que exigen sesión: la ruta de aprendizaje, los simuladores y
 * el test de diagnóstico (escribe en el perfil). Cubren también sus subrutas
 * (`/dashboard/<slug>`, `/simuladores/<tool>`).
 *
 * "/diagnostico" va literal y no importado de `lib/diagnostic` a propósito: este
 * módulo lo carga el middleware, y no queremos arrastrar el pool de preguntas al
 * bundle del edge.
 */
export const PROTECTED_PREFIXES = ["/dashboard", "/simuladores", "/diagnostico"] as const;

/** Destino por defecto tras iniciar sesión si no viene un `redirectTo` válido. */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Destino por defecto tras CREAR la cuenta: el test de diagnóstico. Es el primer
 * paso del onboarding —sustituye a la antigua pregunta "¿cuál es tu nivel?"— y
 * de él sale el nivel con el que el tutor adapta sus explicaciones.
 *
 * Solo aplica cuando el registro no arrastraba un destino explícito: si alguien
 * llegó desde una lección concreta, se respeta a dónde quería ir.
 */
export const DEFAULT_AFTER_REGISTER = "/diagnostico";

/** Nombre del parámetro que transporta el destino a través del login. */
export const REDIRECT_PARAM = "redirectTo";

/** Formulario donde se pide el correo para recuperar la contraseña. */
export const FORGOT_PASSWORD_PATH = "/forgot-password";

/** Página a la que apunta el enlace del correo de recuperación. */
export const RESET_PASSWORD_PATH = "/reset-password";

/** URL pública de producción; fallback si no hay `NEXT_PUBLIC_SITE_URL`. */
const PRODUCTION_SITE_URL = "https://tutor-financiero.vercel.app";

/**
 * URL ABSOLUTA a la que Supabase devuelve al usuario desde el correo de
 * recuperación (`resetPasswordForEmail`). Tiene que ser absoluta porque el
 * enlace se abre desde el cliente de correo, fuera de la app.
 *
 * Se prefiere `NEXT_PUBLIC_SITE_URL` (así en local se prueba contra
 * `http://localhost:3000` y no se salta al dominio de producción) y, si no está
 * definida, se usa el dominio de producción.
 *
 * Recuerda: cada origen usado aquí debe estar en Supabase Dashboard ->
 * Authentication -> URL Configuration -> Redirect URLs, o el enlace del correo
 * caerá en el Site URL por defecto.
 */
export function resetPasswordRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_URL).replace(/\/$/, "");
  return `${base}${RESET_PASSWORD_PATH}`;
}

/** True si la ruta pertenece al área protegida (ella misma o una subruta). */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Caracteres de control (incluidos CR/LF y DEL): podrían partir cabeceras o
 * engañar al parseo de la URL, así que invalidan el destino.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Valida un `redirectTo` que llega por la URL (o sea: no es de fiar).
 *
 * Solo se acepta una ruta interna: debe empezar por "/" y no ser
 * protocol-relative ("//evil.com" o "/\evil.com", que el navegador trata como
 * host externo). Cualquier otra cosa devuelve null y el llamador usa su
 * fallback. Esto cierra el open redirect clásico de `?redirectTo=`.
 */
export function sanitizeRedirectTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (hasControlChars(value)) return null;
  return value;
}

/** `redirectTo` saneado, o el destino por defecto. Nunca devuelve null. */
export function resolveRedirectTo(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  return sanitizeRedirectTo(value) ?? fallback;
}

/** URL de login que recuerda a dónde quería ir el usuario. */
export function loginPath(target?: string | null): string {
  return authPath("/login", target);
}

/** URL de registro que recuerda a dónde quería ir el usuario. */
export function registerPath(target?: string | null): string {
  return authPath("/register", target);
}

function authPath(base: "/login" | "/register", target?: string | null): string {
  const safe = sanitizeRedirectTo(target);
  return safe ? `${base}?${REDIRECT_PARAM}=${encodeURIComponent(safe)}` : base;
}
