"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth-email";
import {
  authErrorLogDetail,
  CONNECTION_ERROR_MESSAGE,
  isConnectionError,
  isServerFault,
} from "@/lib/auth-error";
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
function loginErrorMessage(error: AuthError): string {
  const hint = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  // Ambas van primero: un fallo del servidor no dice NADA sobre las
  // credenciales, y el genérico de abajo ("correo o contraseña incorrectos")
  // sería una acusación falsa que manda a cambiar una clave que está bien.
  if (isConnectionError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }
  if (isServerFault(error)) {
    return "El servicio de autenticación está fallando ahora mismo. No es problema de tus datos; inténtalo de nuevo en unos minutos.";
  }
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

  // Envuelve solo la llamada: `redirect()` navega lanzando y debe quedar fuera.
  let error: AuthError | null;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (thrown) {
    // Credenciales de Supabase ausentes o mal formadas, o un fallo de red que
    // escapó al reintento del SDK. `getOwnPropertyNames` hace visibles `message`
    // y `stack`, que en un Error no son enumerables (sin él sale "{}").
    console.error(
      "Login FetchError details:",
      JSON.stringify(thrown, Object.getOwnPropertyNames(thrown ?? {})),
    );
    return { error: CONNECTION_ERROR_MESSAGE };
  }

  if (error) {
    console.error("SignIn error detail:", authErrorLogDetail(error));
    return { error: loginErrorMessage(error) };
  }

  // redirect() lanza internamente para navegar; debe ir fuera de try/catch.
  redirect(target);
}
