"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_AFTER_LOGIN, registerPath } from "@/lib/auth-redirect";
import type { SubscriptionStatus } from "@/lib/types";

/** Ventaja del plan, tal como se lista en la tarjeta. */
export interface PlanBenefit {
  icon: string;
  title: string;
  description: string;
}

interface PricingProps {
  /** False para el visitante anónimo: la página es pública, el pago no. */
  isAuthenticated: boolean;
  /** Precio ya formateado ("$4.990"): el formato lo decide el servidor. */
  priceLabel: string;
  currencyLabel: string;
  planName: string;
  benefits: PlanBenefit[];
  /** Estado actual de la suscripción del usuario. */
  subscriptionStatus: SubscriptionStatus;
  /** True si el usuario ya tiene acceso completo (incluye período por vencer). */
  hasPremium: boolean;
  /** Fin del período pagado, ya formateado (null si no aplica). */
  periodEndLabel: string | null;
  /** Título de la lección que intentó abrir y disparó el muro de pago. */
  blockedLessonTitle: string | null;
  /** True si volvió del checkout de Mercado Pago (`?estado=procesando`). */
  returningFromCheckout: boolean;
  /** True si el servidor usa credenciales de prueba (no se cobra de verdad). */
  testMode: boolean;
  /** Cuántas lecciones son gratuitas, para contrastar con el plan. */
  freeLessonCount: number;
}

export function Pricing({
  isAuthenticated,
  priceLabel,
  currencyLabel,
  planName,
  benefits,
  subscriptionStatus,
  hasPremium,
  periodEndLabel,
  blockedLessonTitle,
  returningFromCheckout,
  testMode,
  freeLessonCount,
}: PricingProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pide al servidor una suscripción y redirige al checkout de Mercado Pago.
   * El estado Premium no se toca aquí: lo concede el webhook al confirmarse el
   * pago, así que al volver el usuario solo ve un aviso de "procesando".
   */
  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mercadopago/create-subscription", {
        method: "POST",
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        setError(data.error ?? "No se pudo iniciar el pago. Inténtalo de nuevo.");
        setLoading(false);
        return;
      }

      // Salimos del sitio: no se restablece `loading` para evitar un doble clic
      // mientras el navegador navega.
      window.location.href = data.checkoutUrl;
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-base text-white">
              👑
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Membresía Premium
            </h1>
          </div>
          <Link
            href={isAuthenticated ? DEFAULT_AFTER_LOGIN : "/"}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            {isAuthenticated ? "← Volver a mi ruta" : "← Volver al inicio"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Aviso: llegó aquí desde una lección de pago */}
        {blockedLessonTitle && !hasPremium && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-medium">
              👑 «{blockedLessonTitle}» forma parte de la Membresía Premium.
            </p>
            <p className="mt-0.5 text-amber-800">
              Suscríbete para continuar tu ruta desde donde la dejaste.
            </p>
          </div>
        )}

        {/* Aviso: acaba de volver del checkout */}
        {returningFromCheckout && !hasPremium && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          >
            <p className="font-medium">⏳ Estamos confirmando tu pago.</p>
            <p className="mt-0.5 text-sky-800">
              Mercado Pago nos avisará en unos instantes. Recarga esta página en un
              minuto: si el pago se aprobó, tu acceso ya estará activo.
            </p>
          </div>
        )}

        {/* Aviso: ya es Premium */}
        {hasPremium && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <p className="font-medium">
              ✅ Tu membresía está activa. ¡Tienes acceso a todo el contenido!
            </p>
            {subscriptionStatus === "cancelled" && periodEndLabel && (
              <p className="mt-0.5 text-emerald-800">
                Cancelaste la renovación: conservas el acceso hasta el {periodEndLabel}.
              </p>
            )}
            {subscriptionStatus === "active" && periodEndLabel && (
              <p className="mt-0.5 text-emerald-800">
                Próxima renovación: {periodEndLabel}.
              </p>
            )}
          </div>
        )}

        {/* Encabezado comercial */}
        <section className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Desbloquea toda tu ruta financiera
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Las primeras {freeLessonCount} lecciones son gratis para siempre. La membresía
            abre el resto del programa y el tutor de IA sin límites.
          </p>
        </section>

        {/* Tarjeta del plan */}
        <section className="mx-auto mt-6 max-w-xl overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 bg-gradient-to-br from-amber-50 to-white px-6 py-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              <span aria-hidden="true">👑</span> {planName}
            </span>
            <p className="mt-4">
              <span className="text-4xl font-bold tracking-tight text-slate-900">
                {priceLabel}
              </span>
              <span className="ml-1 text-sm font-medium text-slate-500">
                {currencyLabel} / mes
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Se renueva cada mes. Cancela cuando quieras desde Mercado Pago.
            </p>
          </div>

          <ul className="flex flex-col gap-4 px-6 py-6">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-50 text-base"
                  aria-hidden="true"
                >
                  {benefit.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{benefit.title}</p>
                  <p className="text-xs text-slate-600">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 px-6 py-6">
            {hasPremium ? (
              <Link
                href={DEFAULT_AFTER_LOGIN}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Ir a mi ruta de aprendizaje <span aria-hidden="true">→</span>
              </Link>
            ) : !isAuthenticated ? (
              /* Visitante anónimo: el pago necesita una cuenta a la que
                 asociarse, así que primero se registra y vuelve aquí. */
              <>
                <Link
                  href={registerPath("/pricing")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Crear mi cuenta gratis <span aria-hidden="true">→</span>
                </Link>
                <p className="mt-3 text-center text-[11px] text-slate-500">
                  Empieza con las {freeLessonCount} lecciones gratuitas. Podrás suscribirte
                  desde aquí cuando quieras el programa completo.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        aria-hidden="true"
                      />
                      Redirigiendo a Mercado Pago…
                    </>
                  ) : (
                    <>Suscribirse con Mercado Pago</>
                  )}
                </button>

                {error && (
                  <p role="alert" className="mt-3 text-center text-xs text-red-600">
                    {error}
                  </p>
                )}

                <p className="mt-3 text-center text-[11px] text-slate-500">
                  Pago seguro procesado por Mercado Pago. No guardamos los datos de tu
                  tarjeta.
                </p>

                {subscriptionStatus === "pending" && !returningFromCheckout && (
                  <p className="mt-2 text-center text-[11px] text-amber-700">
                    Tienes un pago sin terminar: al continuar retomarás ese mismo
                    checkout.
                  </p>
                )}
              </>
            )}

            {testMode && (
              <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-center text-[11px] text-slate-600">
                🧪 Modo de prueba: se usarán credenciales de Mercado Pago de test y no se
                cobrará dinero real.
              </p>
            )}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-slate-400">
          Contenido educativo. No es asesoría financiera ni recomendación de inversión.
        </p>
      </main>
    </div>
  );
}
