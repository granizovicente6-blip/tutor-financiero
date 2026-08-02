import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DiagnosticTest } from "@/components/DiagnosticTest";
import { DIAGNOSTIC_PATH } from "@/lib/diagnostic";
import { loginPath } from "@/lib/auth-redirect";
import type { FinancialLevel } from "@/lib/types";

export const metadata = {
  title: "Test de Diagnóstico · Tutor Financiero",
  description:
    "Mide tu nivel de conocimiento financiero y personaliza tu ruta de aprendizaje.",
};

/**
 * Pantalla del Test de Diagnóstico de entrada (Server Component).
 *
 * Reemplaza a la antigua selección manual de nivel: aquí el estudiante elige la
 * profundidad del test, responde y el servidor le asigna el nivel
 * (`profiles.financial_level`) que después usan el tutor y la ruta.
 *
 * Exige sesión (defensa en profundidad, además del middleware) porque el
 * resultado se escribe en el perfil.
 */
export default async function DiagnosticPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginPath(DIAGNOSTIC_PATH));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("financial_level")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
              🧭
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Test de Diagnóstico
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            Mi ruta →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <DiagnosticTest
          currentLevel={(profile?.financial_level ?? null) as FinancialLevel | null}
        />
        <p className="mt-8 text-center text-xs text-slate-400">
          Contenido educativo, no es asesoría financiera.
        </p>
      </main>
    </div>
  );
}
