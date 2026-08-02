import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, REDIRECT_PARAM } from "@/lib/auth-redirect";

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas.
 *
 * Se ejecuta desde `src/middleware.ts`. Cumple dos funciones:
 *  1. Mantener las cookies de sesión (access/refresh token) frescas, para que
 *     tanto Server Components como Route Handlers vean al usuario autenticado.
 *  2. Redirigir a `/login?redirectTo=…` a los usuarios no autenticados que
 *     intenten acceder a las rutas protegidas (ver `lib/auth-redirect`).
 *
 * IMPORTANTE (patrón oficial de @supabase/ssr): no ejecutar lógica entre
 * `createServerClient` y `getUser()`, y devolver siempre `supabaseResponse`
 * (con sus cookies) para no romper el ciclo de refresco de sesión.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Modelo guest-first: el sitio es público salvo el área de producto
  // (`/dashboard`, `/simuladores`). La portada, `/pricing`, las páginas
  // informativas y las de auth se visitan sin cuenta; las rutas de API se
  // autoprotegen devolviendo 401 en vez de redirigir.
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Con el destino a cuestas: tras iniciar sesión se retoma donde iba,
    // conservando también sus parámetros (`?bloqueada=…`, etc.).
    url.searchParams.set(REDIRECT_PARAM, `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
