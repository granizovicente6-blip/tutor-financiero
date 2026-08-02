"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  INSTRUMENT_CATEGORY_META,
  RISK_META,
  type Instrument,
  type InstrumentCategory,
} from "@/lib/instruments";

// Render del análisis: encabezados compactos y viñetas legibles en el modal.
const analysisMarkdown: Components = {
  h3: ({ children }) => (
    <h3 className="mt-4 text-sm font-bold text-slate-900 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 text-sm font-bold text-slate-900 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
};

interface MarketsExplorerProps {
  instruments: Instrument[];
  /** Categorías presentes en el catálogo, en su orden canónico. */
  categories: InstrumentCategory[];
  /** True si el usuario tiene membresía activa (abre el análisis con IA). */
  isPremium: boolean;
  /** Precio ya formateado ("$4.990"): el formato lo decide el servidor. */
  priceLabel: string;
  /** Moneda del plan ("CLP"), tal como la publica `lib/subscription`. */
  currencyLabel: string;
  userEmail: string;
}

export function MarketsExplorer({
  instruments,
  categories,
  isPremium,
  priceLabel,
  currencyLabel,
  userEmail,
}: MarketsExplorerProps) {
  /** Filtro activo; `null` = "Todos". */
  const [activeCategory, setActiveCategory] = useState<InstrumentCategory | null>(null);
  /** Instrumento abierto en el modal (null = modal cerrado). */
  const [selected, setSelected] = useState<Instrument | null>(null);

  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * True si el propio servidor rechazó la petición por falta de membresía.
   * Se distingue de `!isPremium` a propósito: el muro real es el del backend y
   * este estado refleja su respuesta, no lo que creía el cliente.
   */
  const [premiumRequired, setPremiumRequired] = useState(false);

  /**
   * Análisis ya generados en esta visita, por ticker. Reabrir una ficha no
   * vuelve a llamar a la IA (ahorra tokens y es instantáneo).
   */
  const cacheRef = useRef<Map<string, string>>(new Map());
  /** Petición en curso, para cortarla si el usuario cierra el modal. */
  const abortRef = useRef<AbortController | null>(null);

  const visible =
    activeCategory === null
      ? instruments
      : instruments.filter((item) => item.category === activeCategory);

  const showPaywall = !isPremium || premiumRequired;

  const closeModal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSelected(null);
    setAnalysis("");
    setError(null);
    setIsLoading(false);
    setPremiumRequired(false);
  }, []);

  // Cerrar con Escape mientras el modal está abierto.
  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, closeModal]);

  // Al desmontar, cortar cualquier stream vivo.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Pide el análisis a la API y lo va pintando conforme llega. */
  const startAnalysis = useCallback(async (instrument: Instrument) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setAnalysis("");

    try {
      const response = await fetch("/api/instruments/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: instrument.ticker }),
        signal: controller.signal,
      });

      // El muro de pago del servidor es la barrera real: si responde 403,
      // el modal cambia a la invitación a suscribirse.
      if (response.status === 403) {
        setPremiumRequired(true);
        return;
      }

      if (response.status === 429) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error ?? "Has alcanzado el límite de solicitudes. Espera unos segundos.",
        );
        return;
      }

      if (!response.ok || response.body === null) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Respuesta no válida del servidor (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnalysis(acc);
      }

      // Solo se cachea el análisis completo (uno cortado a medias se repetiría).
      if (acc.length > 0) {
        cacheRef.current.set(instrument.ticker, acc);
      }
    } catch (err) {
      // Cerrar el modal aborta el fetch: eso no es un error que mostrar.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[mercados] Error al generar el análisis:", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo generar el análisis. Inténtalo de nuevo.",
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  /** Abre la ficha: con membresía lanza el análisis; sin ella, la invitación. */
  function openInstrument(instrument: Instrument) {
    setSelected(instrument);
    setError(null);
    setPremiumRequired(false);

    if (!isPremium) {
      setAnalysis("");
      setIsLoading(false);
      return;
    }

    const cached = cacheRef.current.get(instrument.ticker);
    if (cached) {
      setAnalysis(cached);
      setIsLoading(false);
      return;
    }

    void startAnalysis(instrument);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Presentación de la sección */}
      <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-sky-900">
          <span aria-hidden="true">📈</span> Mercados / ETFs
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Un catálogo de {instruments.length} instrumentos para estudiar cómo está
          construido cada uno. {isPremium
            ? "Abre cualquier ficha para ver el desglose que prepara tu tutor de IA."
            : "Con la Membresía Premium, tu tutor de IA desglosa cada ficha para ti."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Material educativo: no incluye precios en vivo ni recomendaciones de compra o
          venta.
        </p>
      </section>

      {/* Llamada a suscribirse (solo plan gratuito) */}
      {!isPremium && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">
              👑 El análisis con IA es Premium
            </p>
            <p className="text-xs text-amber-800">
              Desbloquéalo por {priceLabel} {currencyLabel}/mes junto con todo el
              programa.
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex-none rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            Ver planes <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      {/* Filtros por categoría */}
      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="mt-5 flex gap-2 overflow-x-auto pb-1"
      >
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          aria-pressed={activeCategory === null}
          className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
            activeCategory === null
              ? "border-sky-600 bg-sky-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-800"
          }`}
        >
          Todos <span className={activeCategory === null ? "opacity-80" : "text-slate-400"}>
            · {instruments.length}
          </span>
        </button>

        {categories.map((category) => {
          const catMeta = INSTRUMENT_CATEGORY_META[category];
          const isActive = category === activeCategory;
          const count = instruments.filter((item) => item.category === category).length;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              aria-pressed={isActive}
              className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-800"
              }`}
            >
              <span aria-hidden="true">{catMeta.emoji}</span> {category}
              <span className={isActive ? "opacity-80" : "text-slate-400"}> · {count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de instrumentos */}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((instrument) => {
          const riskMeta = RISK_META[instrument.risk];
          const catMeta = INSTRUMENT_CATEGORY_META[instrument.category];
          return (
            <li key={instrument.ticker}>
              <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-100 text-lg"
                    aria-hidden="true"
                  >
                    {instrument.emblem}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold tracking-tight text-slate-900">
                        {instrument.ticker}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {instrument.kind}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500" title={instrument.name}>
                      {instrument.name}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {instrument.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${catMeta.chip}`}
                  >
                    {catMeta.emoji} {instrument.category}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${riskMeta.badge}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${riskMeta.dot}`}
                      aria-hidden="true"
                    />
                    {riskMeta.label}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openInstrument(instrument)}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                    isPremium
                      ? "bg-sky-600 hover:bg-sky-700"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {isPremium ? (
                    <>✨ Analizar con IA</>
                  ) : (
                    <>👑 Analizar con IA</>
                  )}
                </button>
              </article>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          No hay instrumentos en esta categoría todavía.
        </p>
      )}

      <p className="mt-8 text-center text-xs text-slate-400" title={userEmail}>
        Sesión de {userEmail} · Contenido educativo, no es asesoría financiera ni
        recomendación de inversión.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: análisis con IA (Premium) o invitación a suscribirse (Free)  */}
      {/* ------------------------------------------------------------------ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="instrument-dialog-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            {/* Cabecera de la ficha */}
            <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
              <span
                className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-100 text-lg"
                aria-hidden="true"
              >
                {selected.emblem}
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="instrument-dialog-title"
                  className="text-base font-bold text-slate-900"
                >
                  {selected.ticker} · {selected.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      INSTRUMENT_CATEGORY_META[selected.category].chip
                    }`}
                  >
                    {INSTRUMENT_CATEGORY_META[selected.category].emoji} {selected.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      RISK_META[selected.risk].badge
                    }`}
                  >
                    {RISK_META[selected.risk].label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                autoFocus
                aria-label="Cerrar"
                className="flex-none rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {showPaywall ? (
                /* ---------- Muro de pago ---------- */
                <div className="text-center">
                  <span className="text-3xl" aria-hidden="true">
                    👑
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    Desbloquea el análisis de mercado con IA
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                    Tu tutor desglosa {selected.ticker} en cuatro partes: qué es, sus pros,
                    sus contras y para qué perfil de inversionista suele estudiarse.
                  </p>

                  <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-2 text-left">
                    {[
                      {
                        icon: "🔍",
                        text: "Desglose con IA de todos los ETFs y acciones del catálogo.",
                      },
                      {
                        icon: "📚",
                        text: "Las 86 lecciones del programa completo.",
                      },
                      {
                        icon: "🎓",
                        text: "Tutor de IA sin límites y retroalimentación de quizzes.",
                      },
                    ].map((benefit) => (
                      <li key={benefit.icon} className="flex items-start gap-2">
                        <span className="flex-none text-base" aria-hidden="true">
                          {benefit.icon}
                        </span>
                        <span className="text-xs text-slate-600">{benefit.text}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p>
                      <span className="text-2xl font-bold tracking-tight text-slate-900">
                        {priceLabel}
                      </span>
                      <span className="ml-1 text-xs font-medium text-slate-500">
                        {currencyLabel} / mes
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      Cancela cuando quieras.
                    </p>
                  </div>

                  <Link
                    href="/pricing"
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    Suscribirme por {priceLabel} {currencyLabel}/mes{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
                  >
                    Ahora no
                  </button>
                </div>
              ) : (
                /* ---------- Análisis con IA ---------- */
                <>
                  <div className="flex items-start gap-2">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-sky-100 text-base">
                      🎓
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      {analysis ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={analysisMarkdown}
                        >
                          {analysis}
                        </ReactMarkdown>
                      ) : isLoading ? (
                        <span className="text-slate-400">
                          Tu tutor está analizando {selected.ticker}…
                        </span>
                      ) : error ? (
                        <span className="text-amber-700">{error}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Error sobrevenido con texto ya pintado */}
                  {error && analysis && (
                    <p role="alert" className="mt-3 text-center text-xs text-amber-700">
                      {error}
                    </p>
                  )}

                  {error && (
                    <button
                      type="button"
                      onClick={() => void startAnalysis(selected)}
                      className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Reintentar análisis
                    </button>
                  )}

                  <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
                    Análisis generado por IA con fines educativos. No incluye precios en
                    vivo ni constituye una recomendación de compra o venta. Verifica
                    siempre los datos en la ficha oficial del emisor.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
