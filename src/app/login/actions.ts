"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth-email";
import { resolveRedirectTo } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

/**
 * Traduce el error de Supabase al mensaje que ve el usuario.
 *
 * Se distinguen solo los casos en los que el usuario puede hacer algo distinto:
 * confirmar el correo, esperar al límite de intentos o revisar lo que escribió.
 * El resto cae en un mensaje genérico —no se detalla si el correo existe— para
 * no convertir el login en un buscador de cuentas.
 */
function loginErrorMessage(code: string | undefined, message: string): string {
  const hint = `${code ?? ""} ${message}`.toLowerCase();

  if (hint.includes("email_not_confirmed") || hint.includes("not confirmed")) {
    return "Tu correo aún no está confirmado. Abre el enlace que te enviamos y vuelve a intentarlo.";
  }
  if (hint.includes("over_request_rate_limit") || hint.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.";
  }
  return "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.";
}

/**
 * Server Action: inicia sesión con email y contraseña.
 *
 * En éxito establece la cookie de sesión y devuelve al usuario a donde iba: el
 * campo oculto `redirectTo` (saneado, solo rutas internas) o, si no viene, la
 * ruta de aprendizaje.
 * En error devuelve un `AuthState` con un mensaje amigable.
 */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const target = resolveRedirectTo(formData.get("redirectTo")?.toString());

  if (!email || !password) {
    return { error: "Introduce tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: loginErrorMessage(error.code, error.message) };
  }

  // redirect() lanza internamente para navegar; debe ir fuera de try/catch.
  redirect(target);
}
