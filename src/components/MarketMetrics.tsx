"use client";

import type { Instrument } from "@/lib/instruments";
import type { MarketSnapshot } from "@/lib/market";
import {
  NO_DATA,
  describeIssue,
  formatAsOf,
  formatMarketCap,
  formatPrice,
  formatRatio,
  formatSignedPercent,
  formatYield,
} from "@/lib/market-format";

// ---------------------------------------------------------------------------
// Panel de métricas financieras de la ficha.
//
// Todo lo que se pinta aquí viene del proveedor de datos a través de
// `/api/market/quote`. Cuando un dato falta se muestra un guion y, debajo, el
// motivo: nunca una estimación. Es normal que un ETF no traiga P/E —un fondo no
// tiene utilidades propias— y esa ausencia también enseña algo.
// ---------------------------------------------------------------------------

interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricTile({ label, value, hint }: MetricTileProps) {
  const isEmpty = value === NO_DATA;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          isEmpty ? "text-slate-300" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{hint}</p>}
    </div>
  );
}

interface MarketMetricsProps {
  instrument: Instrument;
  snapshot: MarketSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function MarketMetrics({
  instrument,
  snapshot,
  isLoading,
  error,
  onRetry,
}: MarketMetricsProps) {
  if (isLoading && !snapshot) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs text-slate-400">
          Consultando datos de mercado de {instrument.ticker}…
        </p>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs text-amber-700">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (!snapshot) return null;

  const { quote, fundamentals, currency, notes } = snapshot;
  const change = quote?.changePercent ?? null;
  const isUp = typeof change === "number" && change > 0;
  const isDown = typeof change === "number" && change < 0;

  const range52 =
    fundamentals && fundamentals.week52Low !== null && fundamentals.week52High !== null
      ? `${formatPrice(fundamentals.week52Low, currency)} – ${formatPrice(
          fundamentals.week52High,
          currency,
        )}`
      : NO_DATA;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold text-slate-700">
          <span aria-hidden="true">💹</span> Datos de mercado
        </h3>
        {quote?.asOf && (
          <p className="text-[11px] text-slate-400">Al {formatAsOf(quote.asOf)}</p>
        )}
      </div>

      {/* Precio y variación: la lectura principal de la ficha. */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          className={`text-2xl font-bold tabular-nums tracking-tight ${
            quote ? "text-slate-900" : "text-slate-300"
          }`}
        >
          {formatPrice(quote?.price ?? null, currency)}
        </p>
        <p
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            isUp
              ? "bg-emerald-100 text-emerald-800"
              : isDown
                ? "bg-red-100 text-red-800"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {formatSignedPercent(change)}
        </p>
        {quote?.previousClose !== null && quote?.previousClose !== undefined && (
          <p className="text-[11px] text-slate-400">
            Cierre anterior {formatPrice(quote.previousClose, currency)}
          </p>
        )}
      </div>

      {notes.quote && (
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
          {describeIssue(notes.quote)}
        </p>
      )}

      {/* Fundamentales */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile
          label="Cap. de mercado"
          value={formatMarketCap(fundamentals?.marketCap ?? null, currency)}
          hint="Valor bursátil total"
        />
        <MetricTile
          label="Ratio P/E"
          value={formatRatio(fundamentals?.peRatio ?? null)}
          hint={
            instrument.kind === "ETF"
              ? "Un fondo no tiene utilidades propias"
              : "Precio / utilidad (12 meses)"
          }
        />
        <MetricTile
          label="Rent. por dividendo"
          value={formatYield(fundamentals?.dividendYield ?? null)}
          hint="Anual, sobre el precio actual"
        />
        <MetricTile label="Rango 52 semanas" value={range52} hint="Mínimo y máximo del año" />
      </div>

      {notes.fundamentals && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {describeIssue(notes.fundamentals)}
        </p>
      )}

      {/* Un error sobrevenido con datos ya en pantalla no borra lo que hay. */}
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-amber-700">
          {error}
        </p>
      )}
    </section>
  );
}
