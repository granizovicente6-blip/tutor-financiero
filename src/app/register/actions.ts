"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AFTER_REGISTER, resolveRedirectTo } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

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
  const email = String(formData.get("email") ?? "").trim();
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
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Este correo ya está registrado. Inicia sesión." };
    }
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  // Sesión presente => confirmación desactivada => entrar directo.
  if (data.session) {
    redirect(target);
  }

  return {
    message: "¡Cuenta creada! Revisa tu correo para confirmarla antes de iniciar sesión.",
  };
}
