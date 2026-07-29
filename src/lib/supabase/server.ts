import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para el SERVIDOR (Server Components, Route Handlers,
 * Server Actions).
 *
 * Lee y escribe las cookies de sesión de Supabase a través de `next/headers`,
 * de modo que la sesión del usuario autenticado esté disponible en el servidor.
 *
 * `cookies()` se `await`-ea para ser compatible tanto con Next.js 14 (donde es
 * síncrono) como con Next.js 15 (donde es asíncrono).
 *
 * Uso (en un Route Handler / Server Component):
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` se llamó desde un Server Component (donde no se pueden
            // escribir cookies). Es seguro ignorarlo si se refresca la sesión
            // desde un middleware. Ver la fase de autenticación.
          }
        },
      },
    },
  );
}
