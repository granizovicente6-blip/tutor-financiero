"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth-email";
import { DEFAULT_AFTER_REGISTER, resolveRedirectTo } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

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
function registerErrorMessage(code: string | undefined, message: string): string {
  const hint = `${code ?? ""} ${message}`.toLowerCase();

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

  return `No se pudo crear la cuenta: ${message}`;
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
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: registerErrorMessage(error.code, error.message) };
  }

  // Sesión presente => confirmación desactivada => entrar directo.
  if (data.session) {
    redirect(target);
  }

  return {
    message: "¡Cuenta creada! Revisa tu correo para confirmarla antes de iniciar sesión.",
  };
}
