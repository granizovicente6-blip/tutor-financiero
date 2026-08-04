import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_AFTER_REGISTER,
  LOGIN_NOTICE_PARAM,
  REDIRECT_PARAM,
  resolveRedirectTo,
} from "@/lib/auth-redirect";

/**
 * Route Handler al que apunta el enlace del correo de confirmación.
 *
 * El registro se hace desde una Server Action, así que el `code_verifier` de
 * PKCE queda en una cookie del servidor: es este handler —y no el cliente del
 * navegador— quien puede canjear el `code` por la sesión. Sin él, pulsar el
 * enlace marcaba el correo como confirmado pero dejaba al usuario fuera, que es
 * justo el síntoma de "Confirmed at con fecha y Last signed in en blanco".
 *
 * En éxito deja la cookie de sesión puesta y sigue al destino que traía el
 * enlace. En cualquier fallo manda al login con un aviso, nunca a una pantalla
 * en blanco: el correo puede haber quedado confirmado igualmente y entonces
 * basta con iniciar sesión a mano.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const target = resolveRedirectTo(searchParams.get(REDIRECT_PARAM), DEFAULT_AFTER_REGISTER);

  /** Redirige a una ruta interna resolviendo contra el origen de esta petición. */
  const goTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // Supabase avisa de un enlace caducado o ya usado por la query, sin mandar
  // ningún código que canjear.
  const linkError = searchParams.get("error_description") ?? searchParams.get("error");
  if (linkError || !code) {
    console.error("Auth callback sin código:", linkError ?? "no llegó el parámetro `code`");
    return goTo(`/login?${LOGIN_NOTICE_PARAM}=enlace-invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Caso típico: el enlace se abrió en otro navegador (o tras limpiar
    // cookies), así que falta el `code_verifier` que acompaña al código.
    console.error("Auth callback error al canjear el código:", error);
    return goTo(`/login?${LOGIN_NOTICE_PARAM}=confirmado`);
  }

  return goTo(target);
}
