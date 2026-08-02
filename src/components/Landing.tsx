import Link from "next/link";
import { DEFAULT_AFTER_LOGIN, loginPath, registerPath } from "@/lib/auth-redirect";

/**
 * Portada pública (Server Component, sin estado).
 *
 * Es la puerta de entrada "guest-first": cualquiera puede verla sin cuenta. Los
 * CTA apuntan al producto si hay sesión y a registro/login (recordando el
 * destino con `redirectTo`) si no la hay, para que el usuario nunca choque con
 * un login sin contexto ni pierda el sitio al que iba.
 */

interface LandingProps {
  /** Si hay sesión, los CTA llevan directo al producto en vez de al registro. */
  isAuthenticated: boolean;
  /** Cifras reales del currículum, para no prometer más de lo que hay. */
  lessonCount: number;
  moduleCount: number;
  freeLessonCount: number;
  /** Precio del plan ya formateado por el servidor ("$4.990"). */
  priceLabel: string;
  currencyLabel: string;
}

interface Highlight {
  emoji: string;
  title: string;
  description: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    emoji: "🤖",
    title: "Un tutor que pregunta, no que sermonea",
    description:
      "Método socrático: te guía con preguntas hasta que el concepto encaja, adaptado a tu nivel.",
  },
  {
    emoji: "📚",
    title: "Una ruta ordenada, no un montón de vídeos",
    description:
      "Finanzas Personales e Inversiones, lección a lección: cada una se apoya en la anterior.",
  },
  {
    emoji: "🧮",
    title: "Simuladores para probarlo con tus números",
    description:
      "Interés compuesto y presupuesto 50/30/20: mueve los controles y observa el efecto.",
  },
  {
    emoji: "🔥",
    title: "Progreso y rachas que sostienen el hábito",
    description:
      "Tu avance por categoría y tu racha de estudio, para volver mañana y no dentro de un mes.",
  },
];

export function Landing({
  isAuthenticated,
  lessonCount,
  moduleCount,
  freeLessonCount,
  priceLabel,
  currencyLabel,
}: LandingProps) {
  // Destino real de cada CTA: con sesión, la ruta; sin ella, la pantalla de
  // auth que corresponda, arrastrando a dónde quería ir.
  const startHref = isAuthenticated ? DEFAULT_AFTER_LOGIN : registerPath(DEFAULT_AFTER_LOGIN);
  const simulatorsHref = isAuthenticated ? "/simuladores" : loginPath("/simuladores");

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
              📊
            </span>
            <span className="text-sm font-semibold text-slate-900 sm:text-base">
              Tutor Financiero
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/pricing"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:px-3"
            >
              Precios
            </Link>
            {isAuthenticated ? (
              <Link
                href={DEFAULT_AFTER_LOGIN}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Ir a mi ruta
              </Link>
            ) : (
              <>
                <Link
                  href={loginPath(DEFAULT_AFTER_LOGIN)}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:px-3"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href={startHref}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Comenzar
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 pb-10 pt-12 text-center sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span aria-hidden="true">✨</span> Las primeras {freeLessonCount} lecciones son
            gratis
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Aprende finanzas con un tutor que se adapta a ti
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {lessonCount} lecciones en {moduleCount} módulos, quizzes con retroalimentación y
            simuladores para practicar con tus propios números. Empieza sin tarjeta.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={startHref}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              {isAuthenticated ? "Continuar mi ruta" : "Comenzar gratis"}
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={simulatorsHref}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              🧮 Ir a simuladores
            </Link>
          </div>

          {!isAuthenticated && (
            <p className="mt-3 text-xs text-slate-500">
              Crear la cuenta toma menos de un minuto y no pedimos datos de pago.
            </p>
          )}
        </section>

        {/* Qué incluye */}
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-emerald-50 text-xl"
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Precio + cierre */}
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <div className="rounded-2xl border border-amber-200 bg-white px-6 py-7 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Gratis para empezar, {priceLabel} {currencyLabel} al mes para todo
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Recorre gratis el inicio de las dos rutas. Cuando quieras el programa completo y
              el tutor sin límites, la membresía se cancela cuando quieras.
            </p>
            <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Link
                href={startHref}
                className="flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {isAuthenticated ? "Continuar mi ruta" : "Comenzar gratis"}
              </Link>
              <Link
                href="/pricing"
                className="flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver el plan Premium
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 px-4 py-6">
        <p className="mx-auto max-w-3xl text-center text-xs text-slate-400">
          Contenido educativo. No es asesoría financiera ni recomendación de inversión.
        </p>
      </footer>
    </div>
  );
}
