import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";
import { loginPath } from "@/lib/auth-redirect";

/**
 * Landing de Simuladores (Server Component).
 * Lista las herramientas interactivas disponibles. Exige sesión (defensa en
 * profundidad además del middleware).
 */

interface SimulatorCard {
  href: string;
  emoji: string;
  title: string;
  description: string;
  available: boolean;
}

const SIMULATORS: SimulatorCard[] = [
  {
    href: "/simuladores/interes-compuesto",
    emoji: "📈",
    title: "Interés compuesto / Proyección de ahorro",
    description:
      "Descubre cómo crece tu ahorro en el tiempo con aportes periódicos. Ajusta los supuestos y observa el efecto de la bola de nieve.",
    available: true,
  },
  {
    href: "/simuladores/presupuesto",
    emoji: "🧾",
    title: "Presupuestador 50/30/20",
    description:
      "Reparte tus ingresos entre necesidades, deseos y futuro para visualizar un presupuesto equilibrado.",
    available: true,
  },
];

export default async function SimuladoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(loginPath("/simuladores"));
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
              🧮
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Simuladores</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            ← Volver al chat
          </Link>
        </div>
      </header>

      <DashboardNav active="simuladores" />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="mb-4 text-sm text-slate-600">
          Herramientas para experimentar con los conceptos. Todos los cálculos usan los
          supuestos que tú definas: son ilustraciones educativas, no proyecciones ni asesoría.
        </p>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SIMULATORS.map((sim) =>
            sim.available ? (
              <li key={sim.title}>
                <Link
                  href={sim.href}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <span className="text-2xl">{sim.emoji}</span>
                  <h2 className="mt-2 text-sm font-semibold text-slate-900">{sim.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{sim.description}</p>
                  <span className="mt-3 text-xs font-medium text-emerald-700">Abrir →</span>
                </Link>
              </li>
            ) : (
              <li key={sim.title}>
                <div className="flex h-full flex-col rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5">
                  <span className="text-2xl opacity-60">{sim.emoji}</span>
                  <h2 className="mt-2 text-sm font-semibold text-slate-500">{sim.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{sim.description}</p>
                  <span className="mt-3 text-xs font-medium text-slate-400">Próximamente</span>
                </div>
              </li>
            ),
          )}
        </ul>
      </main>
    </div>
  );
}
