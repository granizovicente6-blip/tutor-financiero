import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/RegisterForm";
import { REDIRECT_PARAM, resolveRedirectTo } from "@/lib/auth-redirect";

interface RegisterPageProps {
  searchParams: {
    /** `?redirectTo=<ruta>`: destino que se arrastra desde el login o la landing. */
    redirectTo?: string;
  };
}

/**
 * Página de registro (Server Component).
 * Sanea el `redirectTo` de la URL y se lo pasa al formulario; si ya hay sesión,
 * manda al usuario directo a su destino.
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const target = resolveRedirectTo(searchParams[REDIRECT_PARAM]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(target);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
              📊
            </span>
            <h1 className="text-xl font-semibold text-slate-900">Crea tu cuenta</h1>
          </Link>
          <p className="text-sm text-slate-500">
            Empieza gratis: las primeras lecciones no cuestan nada.
          </p>
        </div>

        <RegisterForm redirectTo={target} />

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
