"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth-email";
import { authCallbackUrl, DEFAULT_AFTER_REGISTER, resolveRedirectTo } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

/**
 * Saca un texto utilizable del error de Supabase.
 *
 * `error.message` no siempre trae algo legible: cuando el servidor de Auth
 * responde con un cuerpo de error vacío, el SDK guarda ahí el literal "{}"
 * —`JSON.stringify` del cuerpo— y eso es lo que acabó saliendo en pantalla como
 * "No se pudo crear la cuenta: {}". Por eso los descartes son por CONTENIDO y
 * no por si el campo existe: `message ?? name` no habría arreglado nada.
 *
 * Cuando no hay texto se compone algo con el código y el estado HTTP, que al
 * menos permiten ubicar el fallo en los logs de Supabase.
 */
function describeAuthError(error: AuthError): string {
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
 * Traduce el error de `signUp` al mensaje que ve el usuario.
 *
 * A diferencia del login, aquí SÍ se muestra el texto original de Supabase
 * cuando el motivo no está en la lista. El registro es un callejón sin salida
 * —quien no logra crear la cuenta no puede entrar ni pedir una clave nueva— y
 * un "inténtalo de nuevo" genérico deja al usuario adivinando y a quien reporta
 * el fallo sin nada que contar. No hay riesgo de enumerar cuentas: el caso de
 * "correo ya registrado" es explícito de todos modos.
 */
function registerErrorMessage(error: AuthError): string {
  const detail = describeAuthError(error);
  const message = error.message ?? "";
  const hint = `${error.code ?? ""} ${message}`.toLowerCase();

  if (
    hint.includes("already registered") ||
    hint.includes("user_already_exists") ||
    hint.includes("email_exists")
  ) {
    return "Este correo ya está registrado. Inicia sesión.";
  }
  if (hint.includes("weak_password") || hint.includes("password should be")) {
    return "La contraseña es demasiado débil. Usa al menos 6 caracteres y combina letras y números.";
  }
  if (
    hint.includes("email_address_invalid") ||
    hint.includes("validation_failed") ||
    hint.includes("unable to validate email") ||
    hint.includes("invalid format")
  ) {
    return "El correo no tiene un formato válido. Revísalo e inténtalo de nuevo.";
  }
  if (hint.includes("rate limit") || hint.includes("for security purposes")) {
    // Supabase dice cuántos segundos faltan; repetirlo evita el reintento a ciegas.
    const seconds = /after (\d+) seconds?/.exec(message)?.[1];
    return seconds
      ? `Demasiados intentos seguidos. Espera ${seconds} segundos y vuelve a intentarlo.`
      : "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.";
  }
  if (hint.includes("signup_disabled") || hint.includes("signups not allowed")) {
    return "El registro está deshabilitado en este momento. Inténtalo más tarde.";
  }
  if (hint.includes("email_address_not_authorized")) {
    return "Este correo no está autorizado para registrarse. Prueba con otra dirección.";
  }
  if (
    hint.includes("unexpected_failure") ||
    hint.includes("database error") ||
    hint.includes("error sending")
  ) {
    // Fallo del lado de Supabase, no del usuario: el trigger que crea el perfil
    // o el envío del correo. Reintentar con otros datos no cambia nada, así que
    // no se le sugiere.
    return "No pudimos crear la cuenta por un problema de nuestro servidor. Ya quedó registrado; inténtalo en unos minutos.";
  }

  return `No se pudo crear la cuenta: ${detail}`;
}

/**
 * Server Action: registra un nuevo usuario con email y contraseña.
 *
 * Comportamiento según la configuración de Supabase Auth:
 *  - Si la confirmación por correo está DESACTIVADA: se crea la sesión y se
 *    redirige al destino pedido (`redirectTo`) o al test de diagnóstico.
 *  - Si está ACTIVADA (por defecto): no hay sesión aún; devolvemos un mensaje
 *    pidiendo al usuario que confirme su correo antes de iniciar sesión.
 */
export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  // Sin destino explícito, la cuenta recién creada va al test de diagnóstico:
  // es lo que define el nivel con el que el tutor adapta sus explicaciones.
  const target = resolveRedirectTo(
    formData.get("redirectTo")?.toString(),
    DEFAULT_AFTER_REGISTER,
  );

  if (!email || !password) {
    return { error: "Introduce tu correo y contraseña." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // A dónde lleva el enlace del correo. Sin esto, Supabase usa el Site URL
      // del panel: el correo se confirma pero el `code` cae en una página que
      // no lo canjea, y el usuario queda confirmado pero fuera.
      emailRedirectTo: authCallbackUrl(target),
    },
  });

  if (error) {
    // El detalle completo solo al log del servidor (Vercel -> Logs): trae el
    // status HTTP y el código que el mensaje traducido se deja por el camino.
    console.error("SignUp error detail:", {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status,
      raw: JSON.stringify(error),
    });
    return { error: registerErrorMessage(error) };
  }

  // Confirmación activada + correo YA registrado => Supabase responde éxito con
  // un usuario ficticio y sin identidades, para no revelar qué cuentas existen.
  // Sin este caso, quien se re-registra ve "revisa tu correo" y espera un correo
  // que no llega nunca.
  if (data.user && data.user.identities?.length === 0) {
    return {
      error: "Este correo ya está registrado o en proceso. Si ya confirmaste, inicia sesión.",
    };
  }

  // Sesión presente => confirmación desactivada => entrar directo.
  if (data.session) {
    redirect(target);
  }

  return {
    message: "¡Cuenta creada! Revisa tu correo para confirmarla antes de iniciar sesión.",
  };
}
