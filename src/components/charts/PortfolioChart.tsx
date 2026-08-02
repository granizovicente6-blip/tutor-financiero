"use client";

import { useState, type ReactNode } from "react";
import { formatClp, formatClpAsUf, type PortfolioYearPoint } from "@/lib/portfolio";

// ---------------------------------------------------------------------------
// Gráfico del portafolio (SVG puro, sin librerías de charting).
//
// Área apilada que responde a la pregunta del simulador: cuánto de tu patrimonio
// lo pusiste tú y cuánto lo puso el interés compuesto.
//   - banda inferior (azul)    = capital aportado de tu bolsillo
//   - banda superior (esmeralda) = crecimiento por interés compuesto
// Sobre ellas, la línea de la meta y un lector interactivo: al pasar el mouse
// (o el dedo) por un año, la cabecera muestra las tres cifras de ESE año.
//
// Es responsive vía `viewBox`: escala al ancho del contenedor sin media queries.
// ---------------------------------------------------------------------------

const W = 560;
const H = 280;
const PAD = { top: 18, right: 16, bottom: 30, left: 58 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Redondea hacia arriba a un número "bonito" (1-2-5 × 10^n) para el eje Y. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

/** Formato compacto para el eje Y ($1,2M, $340k, …). */
function compact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

interface PortfolioChartProps {
  series: PortfolioYearPoint[];
  /** Capital objetivo en CLP; 0 = sin línea de meta. */
  goalClp: number;
  /** Nombre de la meta, para la etiqueta de su línea. */
  goalName: string;
}

export function PortfolioChart({
  series,
  goalClp,
  goalName,
}: PortfolioChartProps): ReactNode {
  /** Año que está inspeccionando el usuario; null = se muestra el final. */
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const last = series[series.length - 1];
  const maxYear = Math.max(1, last?.year ?? 1);

  // La escala tiene que dejar sitio a la meta aunque no se alcance: si no, la
  // línea objetivo se saldría del gráfico y no se vería lo lejos que queda.
  const maxBalance = Math.max(...series.map((p) => p.balance), 1);
  const yMax = niceCeil(goalClp > 0 ? Math.max(maxBalance, goalClp * 1.05) : maxBalance);

  const xOf = (year: number): number => PAD.left + (year / maxYear) * PLOT_W;
  const yOf = (value: number): number => PAD.top + PLOT_H - (value / yMax) * PLOT_H;

  const baseline = yOf(0);

  // Área del capital aportado (de 0 hasta la curva de aportes).
  const contributedArea =
    `M ${xOf(series[0].year)},${baseline} ` +
    series.map((p) => `L ${xOf(p.year)},${yOf(p.contributed)}`).join(" ") +
    ` L ${xOf(last.year)},${baseline} Z`;

  // Área de intereses (entre la curva de aportes y la del patrimonio total).
  const interestArea =
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.year)},${yOf(p.balance)}`).join(" ") +
    " " +
    [...series]
      .reverse()
      .map((p) => `L ${xOf(p.year)},${yOf(p.contributed)}`)
      .join(" ") +
    " Z";

  const balanceLine = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.year)},${yOf(p.balance)}`)
    .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  // Hasta ~6 marcas en el eje X, siempre incluyendo el último año.
  const step = Math.max(1, Math.round(maxYear / 6));
  const xTicks: number[] = [];
  for (let y = 0; y <= maxYear; y += step) xTicks.push(y);
  if (xTicks[xTicks.length - 1] !== maxYear) xTicks.push(maxYear);

  const active = series.find((p) => p.year === hoveredYear) ?? last;
  const goalVisible = goalClp > 0 && goalClp <= yMax;
  const interestShare =
    active.balance > 0 ? Math.round((active.interest / active.balance) * 100) : 0;

  return (
    <div>
      {/* Lector: cifras del año inspeccionado (o del final si no hay hover). */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {active.year === 0
              ? "Hoy"
              : `Año ${active.year}${hoveredYear === null ? " (final)" : ""}`}
          </p>
          <p className="text-lg font-bold text-slate-900">{formatClp(active.balance)}</p>
          <p className="text-[11px] text-slate-400">{formatClpAsUf(active.balance)}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" />
              Tú aportaste
            </p>
            <p className="text-sm font-semibold text-slate-700">
              {formatClp(active.contributed)}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              Interés compuesto
            </p>
            <p className="text-sm font-semibold text-emerald-700">
              {formatClp(active.interest)}
              <span className="ml-1 text-[11px] font-medium text-emerald-500">
                ({interestShare}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Evolución del patrimonio proyectado a ${maxYear} años, separando capital aportado e interés compuesto`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredYear(null)}
      >
        <defs>
          <linearGradient id="pf-contributed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="pf-interest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.75} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.3} />
          </linearGradient>
        </defs>

        {/* Rejilla horizontal + etiquetas del eje Y */}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={PAD.left}
              y1={yOf(tick)}
              x2={W - PAD.right}
              y2={yOf(tick)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yOf(tick) + 3}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={10}
            >
              {compact(tick)}
            </text>
          </g>
        ))}

        {/* Áreas apiladas: aportes abajo, intereses encima */}
        <path d={contributedArea} fill="url(#pf-contributed)" />
        <path d={interestArea} fill="url(#pf-interest)" />
        <path d={balanceLine} fill="none" stroke="#059669" strokeWidth={2} />

        {/* Línea de la meta */}
        {goalVisible && (
          <g>
            <line
              x1={PAD.left}
              y1={yOf(goalClp)}
              x2={W - PAD.right}
              y2={yOf(goalClp)}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={W - PAD.right}
              y={yOf(goalClp) - 5}
              textAnchor="end"
              className="fill-amber-600"
              fontSize={10}
              fontWeight={600}
            >
              🎯 {goalName}
            </text>
          </g>
        )}

        {/* Guía vertical del año inspeccionado */}
        {hoveredYear !== null && (
          <g>
            <line
              x1={xOf(active.year)}
              y1={PAD.top}
              x2={xOf(active.year)}
              y2={baseline}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={xOf(active.year)} cy={yOf(active.contributed)} r={3} fill="#0284c7" />
          </g>
        )}

        {/* Punto del patrimonio en el año activo */}
        <circle
          cx={xOf(active.year)}
          cy={yOf(active.balance)}
          r={4}
          fill="#059669"
          stroke="#ffffff"
          strokeWidth={1.5}
        />

        {/* Etiquetas del eje X */}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={xOf(tick)}
            y={H - 9}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize={10}
          >
            {tick === 0 ? "Hoy" : `${tick}a`}
          </text>
        ))}

        {/*
          Zonas sensibles: una banda invisible por año que captura el puntero.
          Van al final para quedar por encima de todo lo pintado, y responden
          también a `focus` para que el gráfico se pueda recorrer con el teclado.
        */}
        {series.map((point, i) => {
          const bandW = PLOT_W / Math.max(1, series.length - 1);
          return (
            <rect
              key={`hit-${point.year}`}
              x={xOf(point.year) - bandW / 2}
              y={PAD.top}
              width={bandW}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`Año ${point.year}: ${formatClp(point.balance)} de patrimonio`}
              onMouseEnter={() => setHoveredYear(point.year)}
              onFocus={() => setHoveredYear(point.year)}
              onBlur={() => setHoveredYear(null)}
              className="cursor-crosshair outline-none focus-visible:fill-slate-900/5"
              style={{ pointerEvents: "all" }}
              data-index={i}
            />
          );
        })}
      </svg>
    </div>
  );
}
