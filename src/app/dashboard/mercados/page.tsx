import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";
import { MarketsExplorer } from "@/components/MarketsExplorer";
import { INSTRUMENTS, getUsedCategories } from "@/lib/instruments";
import {
  PREMIUM_PLAN,
  formatPlanPrice,
  getSubscription,
  hasPremiumAccess,
} from "@/lib/subscription";
import { loginPath } from "@/lib/auth-redirect";

export const metadata = {
  title: "Mercados / ETFs",
  description:
    "Catálogo educativo de ETFs e instrumentos financieros con desglose generado por IA.",
};

/**
 * Página "Mercados / ETFs" del Dashboard (Server Component).
 *
 * - Exige sesión (defensa en profundidad además del middleware).
 * - El CATÁLOGO es público dentro del área de producto: cualquier usuario con
 *   cuenta ve las fichas. Lo que exige membresía es el ANÁLISIS con IA, y esa
 *   barrera vive en `/api/instruments/analyze`; aquí solo se calcula `isPremium`
 *   para decidir qué muestra el botón (análisis o invitación a suscribirse).
 *
 * Nota de rutas: este segmento estático tiene prioridad sobre `[lessonSlug]`,
 * así que "mercados" nunca se interpreta como el slug de una lección.
 */
export default async function MarketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginPath("/dashboard/mercados"));
  }

  const subscription = await getSubscription(supabase, user.id);
  const isPremium = hasPremiumAccess(subscription);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-base text-white">
              📈
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Mercados / ETFs
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

      <DashboardNav active="mercados" />

      <MarketsExplorer
        instruments={INSTRUMENTS}
        categories={getUsedCategories()}
        isPremium={isPremium}
        priceLabel={formatPlanPrice()}
        currencyLabel={PREMIUM_PLAN.currencyId}
        userEmail={user.email ?? ""}
      />
    </div>
  );
}
