import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/LoginForm";
import {
  isProtectedPath,
  LOGIN_NOTICE_PARAM,
  loginNotice,
  REDIRECT_PARAM,
  resolveRedirectTo,
} from "@/lib/auth-redirect";

interface LoginPageProps {
  searchParams: {
    /** `?redirectTo=<ruta>`: a dónde iba el usuario antes de toparse con el login. */
    redirectTo?: string;
    /** `?aviso=<clave>`: por qué lo mandó aquí el enlace de un correo. */
    aviso?: string;
  };
}

/**
 * Página de inicio de sesión (Server Component).
 *
 * Sanea aquí el `redirectTo` que llega por la URL (solo rutas internas) y se lo
 * pasa al formulario, que lo reenvía a la Server Action. Si el usuario ya tiene
 * sesión, no tiene sentido mostrarle el formulario: va directo a su destino.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const target = resolveRedirectTo(searchParams[REDIRECT_PARAM]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(target);
  }

  // El aviso del enlace de correo manda sobre el del rebote: explica algo que
  // acaba de pasar (la confirmación) y no solo por qué se pide la sesión. Si no
  // hay ninguno de los dos, no se le cuenta nada a quien entró por su cuenta.
  const notice =
    loginNotice(searchParams[LOGIN_NOTICE_PARAM]) ??
    (isProtectedPath(target) ? "Crea tu cuenta gratis o inicia sesión para continuar." : null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
              📊
            </span>
            <h1 className="text-xl font-semibold text-slate-900">
              Tutor de Educación Financiera
            </h1>
          </Link>
          <p className="text-sm text-slate-500">Inicia sesión para continuar aprendiendo.</p>
        </div>

        <LoginForm redirectTo={target} notice={notice} />

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
