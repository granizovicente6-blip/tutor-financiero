"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRedirectTo } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

/**
 * Server Action: inicia sesión con email y contraseña.
 *
 * En éxito establece la cookie de sesión y devuelve al usuario a donde iba: el
 * campo oculto `redirectTo` (saneado, solo rutas internas) o, si no viene, la
 * ruta de aprendizaje.
 * En error devuelve un `AuthState` con un mensaje amigable.
 */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const target = resolveRedirectTo(formData.get("redirectTo")?.toString());

  if (!email || !password) {
    return { error: "Introduce tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales inválidas. Revisa tu correo y contraseña." };
  }

  // redirect() lanza internamente para navegar; debe ir fuera de try/catch.
  redirect(target);
}
