"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  INSTRUMENT_CATEGORY_META,
  RISK_META,
  searchInstruments,
  type Instrument,
  type InstrumentCategory,
  type InstrumentKind,
  type RiskLevel,
} from "@/lib/instruments";
import {
  RISK_COLORS,
  SERIES_COLORS,
  TREND_PER_YEAR,
  assumptionsLabel,
  simulateSeries,
  type SeriesPoint,
} from "@/lib/market-series";
import type { MarketSnapshot } from "@/lib/market";
import {
  DEFAULT_RANGE,
  HISTORY_RANGES,
  daysForRange,
  describeIssue,
  type HistoryRangeKey,
} from "@/lib/market-format";
import { MarketChart, type MarketChartSeries } from "@/components/charts/MarketChart";
import { MarketMetrics } from "@/components/MarketMetrics";
import { Sparkline } from "@/components/charts/Sparkline";

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

// ---------------------------------------------------------------------------
// Pestañas: ETFs frente a acciones
//
// La sección separa las dos familias porque no se leen igual. Un ETF es una
// canasta y su ficha se entiende por su composición; una acción es UNA empresa
// y ahí sí tienen sentido la capitalización, el P/E y el dividendo. Mezclarlas
// en una sola grilla obligaba a explicar todo el rato de qué tipo era cada una.
// ---------------------------------------------------------------------------

const KIND_TABS: { key: InstrumentKind; label: string; emoji: string }[] = [
  { key: "ETF", label: "ETFs", emoji: "🧺" },
  { key: "Acción", label: "Acciones", emoji: "🏢" },
];

// ---------------------------------------------------------------------------
// Gráfico comparativo: qué se dibuja por defecto
// ---------------------------------------------------------------------------

/** Cuántas trayectorias se pueden superponer sin que el gráfico se vuelva ilegible. */
const MAX_SERIES = 4;

/** Horizontes ofrecidos en el selector del gráfico simulado, en años. */
const HORIZONS = [3, 5, 10] as const;

/** Años del gráfico simulado de la ficha (fijo: la comparación no aplica). */
const DETAIL_YEARS = 10;

const RISK_ORDER: RiskLevel[] = ["bajo", "moderado", "alto", "muy alto"];

/** Milisegundos de un año medio; convierte fechas reales al eje del gráfico. */
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Selección inicial del gráfico: un instrumento por nivel de riesgo (hasta
 * tres). Comparar un "riesgo bajo" con un "riesgo alto" enseña bastante más
 * que comparar los tres primeros del catálogo, que suelen ser casi idénticos.
 */
function defaultSelection(pool: Instrument[]): string[] {
  const firstByRisk = new Map<RiskLevel, string>();
  for (const item of pool) {
    if (!firstByRisk.has(item.risk)) firstByRisk.set(item.risk, item.ticker);
  }
  const byRisk = RISK_ORDER.map((risk) => firstByRisk.get(risk)).filter(
    (ticker): ticker is string => ticker !== undefined,
  );
  return (byRisk.length > 0 ? byRisk : pool.map((item) => item.ticker)).slice(0, 3);
}

/** Respuesta de `/api/market/quote`: la instantánea más el rango que cubre. */
type MarketSnapshotResponse = MarketSnapshot & { range: HistoryRangeKey };

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
  /** Pestaña activa: ETFs o acciones individuales. */
  const [activeKind, setActiveKind] = useState<InstrumentKind>("ETF");
  /** Filtro de categoría dentro de la pestaña; `null` = "Todas". */
  const [activeCategory, setActiveCategory] = useState<InstrumentCategory | null>(null);
  /** Texto del buscador (símbolo, nombre, categoría o emisor). */
  const [query, setQuery] = useState("");
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
  /** Petición de análisis en curso, para cortarla si se cierra el modal. */
  const abortRef = useRef<AbortController | null>(null);

  const showPaywall = !isPremium || premiumRequired;

  // -------------------------------------------------------------------------
  // Filtrado: pestaña -> categoría -> buscador
  // -------------------------------------------------------------------------

  /** Instrumentos de la pestaña y la categoría activas, sin aplicar el buscador. */
  const scopedPool = useMemo(() => {
    const byKind = instruments.filter((item) => item.kind === activeKind);
    return activeCategory === null
      ? byKind
      : byKind.filter((item) => item.category === activeCategory);
  }, [instruments, activeKind, activeCategory]);

  /** Lo que finalmente se ve en la grilla. */
  const visible = useMemo(
    () => searchInstruments(scopedPool, query),
    [scopedPool, query],
  );

  /** Categorías con instrumentos en la pestaña activa, en el orden canónico. */
  const kindCategories = useMemo(() => {
    const inKind = instruments.filter((item) => item.kind === activeKind);
    return categories.filter((category) =>
      inKind.some((item) => item.category === category),
    );
  }, [categories, instruments, activeKind]);

  /** Cuántos instrumentos tiene la pestaña activa (para el contador de "Todas"). */
  const kindTotals = useMemo(() => {
    const totals = new Map<InstrumentKind, number>();
    for (const item of instruments) {
      totals.set(item.kind, (totals.get(item.kind) ?? 0) + 1);
    }
    return totals;
  }, [instruments]);

  /** Al cambiar de pestaña la categoría deja de aplicar: puede no existir ahí. */
  function selectKind(kind: InstrumentKind) {
    setActiveKind(kind);
    setActiveCategory(null);
  }

  // -------------------------------------------------------------------------
  // Gráfico comparativo (simulación educativa; ver `lib/market-series`)
  // -------------------------------------------------------------------------

  /** Horizonte del gráfico comparativo, en años. */
  const [horizon, setHorizon] = useState<number>(5);
  /** Instrumentos superpuestos en el gráfico comparativo (máx. `MAX_SERIES`). */
  const [chartTickers, setChartTickers] = useState<string[]>(() =>
    defaultSelection(instruments.filter((item) => item.kind === "ETF")),
  );

  // Al cambiar de pestaña o categoría el gráfico se repuebla con lo que hay a
  // la vista: seguir dibujando un ETF que ya no aparece despista más que ayuda.
  // El buscador NO entra aquí a propósito, para que el gráfico no salte con
  // cada tecla que se escribe.
  useEffect(() => {
    setChartTickers(defaultSelection(scopedPool));
  }, [scopedPool]);

  /** Añade o quita una serie del gráfico comparativo. */
  function toggleTicker(ticker: string) {
    setChartTickers((current) => {
      if (current.includes(ticker)) {
        // Nunca dejar el gráfico vacío: la última serie no se puede quitar.
        return current.length === 1 ? current : current.filter((item) => item !== ticker);
      }
      // Al llegar al tope entra la nueva y sale la más antigua.
      const next = [...current, ticker];
      return next.slice(Math.max(0, next.length - MAX_SERIES));
    });
  }

  const chartSeries = useMemo<MarketChartSeries[]>(
    () =>
      chartTickers
        .map((ticker, index): MarketChartSeries | null => {
          const instrument = instruments.find((item) => item.ticker === ticker);
          if (!instrument) return null;
          return {
            ticker: instrument.ticker,
            name: instrument.name,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            points: simulateSeries(instrument.ticker, instrument.risk, horizon),
          };
        })
        .filter((serie): serie is MarketChartSeries => serie !== null),
    [chartTickers, horizon, instruments],
  );

  /** Trayectoria corta de cada tarjeta. Se calcula una vez para todo el catálogo. */
  const sparklines = useMemo(() => {
    const map = new Map<string, SeriesPoint[]>();
    for (const item of instruments) {
      map.set(item.ticker, simulateSeries(item.ticker, item.risk, 3));
    }
    return map;
  }, [instruments]);

  /** Serie simulada del instrumento abierto (respaldo si no hay historial real). */
  const simulatedDetailSeries = useMemo<MarketChartSeries[]>(
    () =>
      selected
        ? [
            {
              ticker: selected.ticker,
              name: selected.name,
              color: SERIES_COLORS[0],
              points: simulateSeries(selected.ticker, selected.risk, DETAIL_YEARS),
            },
          ]
        : [],
    [selected],
  );

  // -------------------------------------------------------------------------
  // Datos de mercado reales de la ficha abierta
  // -------------------------------------------------------------------------

  const [range, setRange] = useState<HistoryRangeKey>(DEFAULT_RANGE);
  const [snapshot, setSnapshot] = useState<MarketSnapshotResponse | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  /** Instantáneas ya traídas en esta visita, por ticker y rango. */
  const snapshotCacheRef = useRef<Map<string, MarketSnapshotResponse>>(new Map());
  const marketAbortRef = useRef<AbortController | null>(null);

  const loadSnapshot = useCallback(
    async (ticker: string, rangeKey: HistoryRangeKey) => {
      const cacheKey = `${ticker}:${rangeKey}`;
      const cached = snapshotCacheRef.current.get(cacheKey);
      if (cached) {
        setSnapshot(cached);
        setSnapshotError(null);
        setSnapshotLoading(false);
        return;
      }

      marketAbortRef.current?.abort();
      const controller = new AbortController();
      marketAbortRef.current = controller;

      setSnapshotLoading(true);
      setSnapshotError(null);

      try {
        const response = await fetch(
          `/api/market/quote?ticker=${encodeURIComponent(ticker)}&range=${rangeKey}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            data?.error ?? `No se pudieron obtener los datos de mercado (${response.status}).`,
          );
        }
        const data = (await response.json()) as MarketSnapshotResponse;
        snapshotCacheRef.current.set(cacheKey, data);
        setSnapshot(data);
      } catch (err) {
        // Cerrar el modal aborta el fetch: eso no es un error que mostrar.
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[mercados] Error al obtener datos de mercado:", err);
        setSnapshotError(
          err instanceof Error && err.message
            ? err.message
            : "No se pudieron obtener los datos de mercado.",
        );
      } finally {
        if (marketAbortRef.current === controller) {
          marketAbortRef.current = null;
          setSnapshotLoading(false);
        }
      }
    },
    [],
  );

  function selectRange(next: HistoryRangeKey) {
    setRange(next);
    if (selected) void loadSnapshot(selected.ticker, next);
  }

  /**
   * Gráfico de rendimiento con precios REALES, normalizado a base 100 en el
   * primer cierre del rango. Se normaliza en vez de dibujar el precio para que
   * la lectura sea "cuánto ha rendido en el período", que es lo que interesa
   * comparar, y para reutilizar el mismo eje que la simulación.
   */
  const realSeries = useMemo<MarketChartSeries[] | null>(() => {
    const history = snapshot?.history;
    if (!selected || !history || history.length < 2) return null;

    const startMs = Date.parse(history[0].date);
    const base = history[0].close;
    if (!Number.isFinite(startMs) || !(base > 0)) return null;

    return [
      {
        ticker: selected.ticker,
        name: selected.name,
        color: SERIES_COLORS[0],
        points: history.map((point) => ({
          year: (Date.parse(point.date) - startMs) / YEAR_MS,
          value: (point.close / base) * 100,
        })),
      },
    ];
  }, [snapshot, selected]);

  const realYears = realSeries
    ? realSeries[0].points[realSeries[0].points.length - 1].year
    : 0;

  /** Etiquetas del eje del gráfico real: fechas, no horizontes supuestos. */
  const formatRealTime = useCallback(
    (year: number): string => {
      const history = snapshot?.history;
      if (!history || history.length === 0) return "";
      const startMs = Date.parse(history[0].date);
      const date = new Date(startMs + year * YEAR_MS);
      const longRange = daysForRange(snapshot?.range ?? DEFAULT_RANGE) > 400;
      return date.toLocaleDateString(
        "es-CL",
        longRange
          ? { month: "short", year: "numeric" }
          : { day: "2-digit", month: "short" },
      );
    },
    [snapshot],
  );

  // -------------------------------------------------------------------------
  // Ciclo de vida del modal
  // -------------------------------------------------------------------------

  const closeModal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    marketAbortRef.current?.abort();
    marketAbortRef.current = null;
    setSelected(null);
    setAnalysis("");
    setError(null);
    setIsLoading(false);
    setPremiumRequired(false);
    setSnapshot(null);
    setSnapshotError(null);
    setSnapshotLoading(false);
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

  // Al desmontar, cortar cualquier petición viva.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      marketAbortRef.current?.abort();
    },
    [],
  );

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

  /** Abre la ficha: datos de mercado siempre; el análisis con IA, si es Premium. */
  function openInstrument(instrument: Instrument) {
    setSelected(instrument);
    setError(null);
    setPremiumRequired(false);

    // Los datos de mercado no dependen de la membresía: son públicos.
    setSnapshot(null);
    setSnapshotError(null);
    setRange(DEFAULT_RANGE);
    void loadSnapshot(instrument.ticker, DEFAULT_RANGE);

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

  const kindLabel = activeKind === "ETF" ? "ETFs" : "acciones";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Presentación de la sección */}
      <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-sky-900">
          <span aria-hidden="true">📊</span> Análisis de Mercado
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Un catálogo de {instruments.length} instrumentos —ETFs y acciones— para
          estudiar cómo está construido cada uno.{" "}
          {isPremium
            ? "Abre cualquier ficha para ver sus métricas y el desglose que prepara tu tutor de IA."
            : "Con la Membresía Premium, tu tutor de IA desglosa cada ficha para ti."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Material educativo. Los precios y ratios provienen de un proveedor externo y
          pueden venir con retraso; nada de lo que aparece aquí es una recomendación de
          compra o venta.
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

      {/* Pestañas: ETFs / Acciones */}
      <div
        role="tablist"
        aria-label="Tipo de instrumento"
        className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1"
      >
        {KIND_TABS.map((tab) => {
          const isActive = tab.key === activeKind;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectKind(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span aria-hidden="true">{tab.emoji}</span> {tab.label}
              <span className="text-slate-400"> · {kindTotals.get(tab.key) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Buscador */}
      <div className="mt-3">
        <label htmlFor="market-search" className="sr-only">
          Buscar {kindLabel} por símbolo o nombre
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            aria-hidden="true"
          >
            🔎
          </span>
          <input
            id="market-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeKind === "Acción"
                ? "Busca una acción: AAPL, Microsoft, semiconductores…"
                : "Busca un ETF: VOO, Vanguard, dividendos…"
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>
        <p aria-live="polite" className="mt-1 text-xs text-slate-400">
          {query === ""
            ? `${visible.length} ${visible.length === 1 ? "instrumento" : "instrumentos"} a la vista`
            : `${visible.length} ${visible.length === 1 ? "resultado" : "resultados"} para “${query}”`}
        </p>
      </div>

      {/* Filtros por categoría (dentro de la pestaña activa) */}
      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="mt-2 flex gap-2 overflow-x-auto pb-1"
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
          Todas{" "}
          <span className={activeCategory === null ? "opacity-80" : "text-slate-400"}>
            · {kindTotals.get(activeKind) ?? 0}
          </span>
        </button>

        {kindCategories.map((category) => {
          const catMeta = INSTRUMENT_CATEGORY_META[category];
          const isActive = category === activeCategory;
          const count = instruments.filter(
            (item) => item.kind === activeKind && item.category === category,
          ).length;
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

      {/* ------------------------------------------------------------------ */}
      {/* Gráfico comparativo de evolución (simulación, no precios reales)    */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              <span aria-hidden="true">📉</span> Evolución simulada · base 100
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Cómo se movería una inversión de 100 según la volatilidad de cada perfil de
              riesgo. Son trayectorias <strong>simuladas</strong>, no el precio histórico
              del instrumento (ese está en cada ficha).
            </p>
          </div>
          <div
            role="group"
            aria-label="Horizonte del gráfico"
            className="flex flex-none gap-1 rounded-lg bg-slate-100 p-1"
          >
            {HORIZONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setHorizon(option)}
                aria-pressed={horizon === option}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  horizon === option
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {option} años
              </button>
            ))}
          </div>
        </div>

        {/* Selector de series: los instrumentos de la pestaña a la vista. */}
        <div
          role="group"
          aria-label="Instrumentos del gráfico"
          className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
        >
          {scopedPool.map((instrument) => {
            const index = chartTickers.indexOf(instrument.ticker);
            const isOn = index !== -1;
            return (
              <button
                key={instrument.ticker}
                type="button"
                onClick={() => toggleTicker(instrument.ticker)}
                aria-pressed={isOn}
                title={instrument.name}
                className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  isOn
                    ? "border-slate-300 bg-slate-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-700"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: isOn
                      ? SERIES_COLORS[index % SERIES_COLORS.length]
                      : "#cbd5e1",
                  }}
                  aria-hidden="true"
                />
                {instrument.ticker}
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          {chartSeries.length > 0 ? (
            <MarketChart series={chartSeries} years={horizon} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              Elige al menos un instrumento para dibujar el gráfico.
            </p>
          )}
        </div>

        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
          Modelo educativo: todas las series comparten la misma tendencia (
          {Math.round(TREND_PER_YEAR * 100)}% real anual) y solo se diferencian por su
          volatilidad, de {assumptionsLabel("bajo")} en el riesgo bajo a{" "}
          {assumptionsLabel("muy alto")} en el muy alto. Así el gráfico compara cuánto se
          agita cada instrumento, no cuánto rinde: no representa el desempeño pasado ni
          futuro de ningún fondo. Puedes superponer hasta {MAX_SERIES} instrumentos.
        </p>
      </section>

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

                {/* Mini-gráfico: la forma del riesgo, sin cifras (esas van en la ficha). */}
                <div className="mt-3">
                  <Sparkline
                    points={sparklines.get(instrument.ticker) ?? []}
                    color={RISK_COLORS[instrument.risk]}
                    idKey={instrument.ticker}
                    label={`Trayectoria simulada de ${instrument.ticker} a 3 años`}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Movimiento simulado · 3 años
                  </p>
                </div>

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
                  {isPremium ? <>✨ Analizar con IA</> : <>👑 Analizar con IA</>}
                </button>
              </article>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          {query === ""
            ? "No hay instrumentos en esta categoría todavía."
            : `Ningún instrumento del catálogo coincide con “${query}”.`}
        </p>
      )}

      <p className="mt-8 text-center text-xs text-slate-400" title={userEmail}>
        Sesión de {userEmail} · Contenido educativo, no es asesoría financiera ni
        recomendación de inversión.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: ficha del instrumento                                        */}
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {selected.kind}
                  </span>
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
              {/*
                Métricas y gráfico van ANTES del muro de pago a propósito: son
                datos públicos o cálculos locales, no cuestan tokens, así que
                también los ve el plan gratuito. Lo que exige membresía es el
                desglose que escribe la IA.
              */}
              <div className="mb-4">
                <MarketMetrics
                  instrument={selected}
                  snapshot={snapshot}
                  isLoading={snapshotLoading}
                  error={snapshotError}
                  onRetry={() => void loadSnapshot(selected.ticker, range)}
                />
              </div>

              {/* Gráfico de rendimiento: real si hay historial, simulado si no. */}
              <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-slate-700">
                      {realSeries
                        ? "Rendimiento del período · base 100"
                        : `Evolución simulada · ${DETAIL_YEARS} años`}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {realSeries
                        ? "Precios de cierre reales, reescalados a 100 al inicio del rango"
                        : "Base 100 · no son precios reales"}
                    </p>
                  </div>

                  {/* El selector de rango solo tiene sentido con datos reales. */}
                  {realSeries && (
                    <div
                      role="group"
                      aria-label="Rango del gráfico"
                      className="flex flex-none gap-1 rounded-lg bg-slate-200/70 p-1"
                    >
                      {HISTORY_RANGES.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => selectRange(option.key)}
                          aria-pressed={range === option.key}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                            range === option.key
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {option.key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  {realSeries ? (
                    <MarketChart
                      series={realSeries}
                      years={Math.max(realYears, 0.01)}
                      formatTime={formatRealTime}
                      ariaLabel={`Rendimiento real de ${selected.ticker} en el rango ${range}, reescalado a base 100. Usa las flechas izquierda y derecha para recorrerlo.`}
                    />
                  ) : (
                    <MarketChart series={simulatedDetailSeries} years={DETAIL_YEARS} />
                  )}
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {realSeries ? (
                    <>
                      Cierres diarios del proveedor de datos, reescalados a 100 en el
                      primer día del rango para leer el rendimiento del período.
                      Rentabilidades pasadas no anticipan resultados futuros.
                    </>
                  ) : (
                    <>
                      {snapshotLoading
                        ? "Buscando el historial real de precios… "
                        : snapshot?.notes.history
                          ? `${describeIssue(snapshot.notes.history)} `
                          : ""}
                      Mientras tanto se muestra una trayectoria <strong>simulada</strong>{" "}
                      para un instrumento de{" "}
                      {RISK_META[selected.risk].label.toLowerCase()} (
                      {assumptionsLabel(selected.risk)}). Ilustra cuánto se mueve un perfil
                      así, no el desempeño de {selected.ticker}.
                    </>
                  )}
                </p>
              </section>

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
                    Análisis generado por IA con fines educativos. El texto no incorpora
                    los precios de esta ficha y no constituye una recomendación de compra
                    o venta. Verifica siempre los datos en la ficha oficial del emisor.
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
