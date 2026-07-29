import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BudgetSimulator } from "@/components/simulators/BudgetSimulator";

/**
 * Simulador Presupuestador 50/30/20 (Server Component).
 * Exige sesión y monta el componente cliente que reparte el ingreso en vivo.
 */
export default async function PresupuestoPage() {
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
            href="/dashboard/el-presupuesto"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Ver la lección teórica
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">Presupuestador 50/30/20</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Introduce tu ingreso neto mensual y reparte cada peso entre{" "}
          <strong>necesidades</strong>, <strong>deseos</strong> y{" "}
          <strong>futuro</strong>. Empieza con la regla 50/30/20 y ajústala a tu realidad.
        </p>

        <div className="mt-6">
          <BudgetSimulator />
        </div>
      </main>
    </div>
  );
}
