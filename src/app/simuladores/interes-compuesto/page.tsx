import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompoundInterestSimulator } from "@/components/simulators/CompoundInterestSimulator";

/**
 * Simulador de Interés Compuesto / Proyección de Ahorro (Server Component).
 * Exige sesión y monta el componente cliente que hace el cálculo en vivo.
 */
export default async function InteresCompuestoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/simuladores"
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            ← Simuladores
          </Link>
          <Link
            href="/dashboard/interes-compuesto"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Ver la lección teórica
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">
          Interés compuesto / Proyección de ahorro
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Mueve los controles y observa cómo el tiempo y los aportes constantes hacen crecer
          el ahorro. Fíjate en cuánto del saldo final son <strong>intereses</strong> frente a
          lo que realmente aportaste.
        </p>

        <div className="mt-6">
          <CompoundInterestSimulator />
        </div>
      </main>
    </div>
  );
}
