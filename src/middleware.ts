import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware raíz de Next.js. Refresca la sesión de Supabase y protege rutas.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Ejecuta el middleware en todas las rutas EXCEPTO archivos estáticos e
  // imágenes (no necesitan sesión y así evitamos trabajo innecesario).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
