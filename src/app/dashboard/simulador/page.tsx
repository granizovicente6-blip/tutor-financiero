import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";
import { PortfolioSimulator } from "@/components/simulators/PortfolioSimulator";
import { formatPlanPrice, getSubscription, hasPremiumAccess } from "@/lib/subscription";
import { loginPath } from "@/lib/auth-redirect";

export const metadata = {
  title: "Simulador UF",
  description:
    "Proyecta tu portafolio en UF y pesos chilenos, y descubre cuándo alcanzarías tu independencia financiera.",
};

/**
 * Página "Simulador UF" del Dashboard (Server Component).
 *
 * Exige sesión (defensa en profundidad además del middleware) y calcula aquí,
 * en el servidor, si el usuario tiene membresía: el cliente recibe un booleano
 * ya resuelto y nunca la fila de `profiles`.
 *
 * El simulador es 100% cálculo local, así que el muro de pago no protege una API
 * sino la profundidad de la herramienta (horizonte, perfiles, impuestos y
 * cartera). Por eso `isPremium` viaja como prop y el propio componente recorta
 * los parámetros, en vez de limitarse a esconder botones.
 *
 * Nota de rutas: este segmento estático tiene prioridad sobre `[lessonSlug]`,
 * así que "simulador" nunca se interpreta como el slug de una lección.
 */
export default async function SimuladorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginPath("/dashboard/simulador"));
  }

  const subscription = await getSubscription(supabase, user.id);
  const isPremium = hasPremiumAccess(subscription);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
              📊
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Simulador UF
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {isPremium ? (
              <span
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
                title="Membresía Premium activa"
              >
                👑 Premium
              </span>
            ) : (
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
              >
                👑 Premium
              </Link>
            )}
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              ← Volver al chat
            </Link>
          </div>
        </div>
      </header>

      <DashboardNav active="simulador" />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-slate-600">
          Portafolio e independencia financiera en clave chilena: define tus aportes y tu
          perfil, y observa cuánto del patrimonio lo pones tú y cuánto lo pone el interés
          compuesto. Las rentabilidades son <strong>reales</strong> (sobre la inflación), así
          que el resultado se lee en pesos de hoy y en UF.
        </p>

        <PortfolioSimulator
          isPremium={isPremium}
          priceLabel={formatPlanPrice()}
          currentYear={new Date().getFullYear()}
        />
      </main>
    </div>
  );
}
