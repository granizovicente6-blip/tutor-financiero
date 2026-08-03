"use client";

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { SERIES_BASE, changeFromBase, formatChange, type SeriesPoint } from "@/lib/market-series";

// ---------------------------------------------------------------------------
// Gráfico de evolución de instrumentos (SVG puro, sin librerías de charting).
//
// Superpone hasta cuatro trayectorias en base 100 para comparar cómo se mueve
// cada perfil de riesgo. Al recorrerlo con el mouse, el dedo o las flechas del
// teclado, la cabecera muestra el valor de TODAS las series en ese instante:
// esa comparación simultánea es justo lo que enseña el gráfico.
//
// Mismo enfoque que `PortfolioChart`: responsive por `viewBox`, sin media
// queries. La diferencia es el lector de posición: aquí hay muchos más puntos
// (mensuales), así que en vez de una zona sensible por punto se usa una sola
// superficie y se traduce la coordenada del puntero a índice.
// ---------------------------------------------------------------------------

const W = 560;
const H = 240;
const PAD = { top: 14, right: 14, bottom: 26, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Una serie a dibujar. Todas deben tener el mismo número de puntos. */
export interface MarketChartSeries {
  ticker: string;
  name: string;
  /** Color de la línea (hex; ver `SERIES_COLORS`). */
  color: string;
  points: SeriesPoint[];
}

/** Escala "bonita" que envuelve el rango de valores con pasos 1-2-5 × 10^n. */
function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const span = Math.max(max - min, 1);
  const rawStep = span / 4;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const frac = rawStep / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  const step = niceFrac * base;

  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  // El medio paso extra absorbe el error de coma flotante del acumulador.
  for (let value = lo; value <= hi + step / 2; value += step) ticks.push(value);
  return { lo, hi, ticks };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface MarketChartProps {
  series: MarketChartSeries[];
  /** Horizonte en años, para las etiquetas del eje X. */
  years: number;
  /**
   * Etiqueta del eje X y del lector, a partir de los años transcurridos.
   *
   * Por defecto se rotula en años ("3a"), que es lo que pide la simulación
   * educativa. El gráfico de rendimiento real lo sobrescribe para mostrar
   * fechas, porque ahí el eje son días de mercado y no un horizonte supuesto.
   */
  formatTime?: (year: number) => string;
  /** Descripción para lectores de pantalla; por defecto, la de la simulación. */
  ariaLabel?: string;
}

export function MarketChart({
  series,
  years,
  formatTime,
  ariaLabel,
}: MarketChartProps): ReactNode {
  /** Índice inspeccionado; null = se muestra el final de la serie. */
  const [hovered, setHovered] = useState<number | null>(null);

  const length = series[0]?.points.length ?? 0;
  if (length === 0) return null;

  const activeIndex = hovered === null ? length - 1 : clamp(hovered, 0, length - 1);
  const activeYear = series[0].points[activeIndex].year;

  const values = series.flatMap((line) => line.points.map((point) => point.value));
  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));

  const xOf = (year: number): number => PAD.left + (year / Math.max(years, 0.01)) * PLOT_W;
  const yOf = (value: number): number =>
    PAD.top + PLOT_H - ((value - lo) / Math.max(hi - lo, 1)) * PLOT_H;

  /** Traduce la posición horizontal del puntero al índice del punto más cercano. */
  function indexFromClientX(clientX: number, element: SVGSVGElement): number {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0) return 0;
    // `h-auto w-full` conserva la relación de aspecto, así que el viewBox
    // escala linealmente y basta con una regla de tres.
    const x = ((clientX - rect.left) / rect.width) * W;
    const ratio = (x - PAD.left) / PLOT_W;
    return clamp(Math.round(ratio * (length - 1)), 0, length - 1);
  }

  function onMouseMove(event: MouseEvent<SVGSVGElement>) {
    setHovered(indexFromClientX(event.clientX, event.currentTarget));
  }

  function onTouchMove(event: TouchEvent<SVGSVGElement>) {
    const touch = event.touches[0];
    if (touch) setHovered(indexFromClientX(touch.clientX, event.currentTarget));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setHovered(clamp(activeIndex + delta, 0, length - 1));
  }

  // Marcas del eje X: una por año (hasta seis), más el extremo. Por debajo del
  // año la marca anual no serviría (solo saldría "Hoy"), así que en tramos
  // cortos —los rangos del gráfico de rendimiento real— se reparten cinco.
  const yearStep = years >= 3 ? Math.max(1, Math.ceil(years / 6)) : years / 4;
  const xTicks: number[] = [];
  if (yearStep > 0) {
    // El medio paso extra absorbe el error de coma flotante del acumulador.
    for (let year = 0; year <= years - yearStep / 2; year += yearStep) xTicks.push(year);
  }
  if (xTicks[xTicks.length - 1] !== years) xTicks.push(years);

  return (
    <div>
      {/* Lector: valor de cada serie en el punto inspeccionado. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {formatTime
            ? `${formatTime(activeYear)}${hovered === null ? " (final)" : ""}`
            : activeIndex === 0
              ? "Hoy"
              : `Mes ${Math.round(activeYear * 12)}${hovered === null ? " (final)" : ""}`}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((line) => {
            const value = line.points[activeIndex].value;
            const change = changeFromBase(value);
            return (
              <li key={line.ticker} className="flex items-baseline gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 flex-none rounded-sm"
                  style={{ backgroundColor: line.color }}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-slate-700">{line.ticker}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {Math.round(value)}
                </span>
                <span
                  className={`text-[11px] font-medium tabular-nums ${
                    change >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatChange(change)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        role="img"
        tabIndex={0}
        aria-label={
          ariaLabel ??
          `Evolución simulada a ${years} años de ${series
            .map((line) => line.ticker)
            .join(", ")}, en base 100. Usa las flechas izquierda y derecha para recorrerla.`
        }
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        onTouchMove={onTouchMove}
        onTouchEnd={() => setHovered(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHovered(null)}
      >
        {/* Rejilla horizontal + etiquetas del eje Y */}
        {ticks.map((tick) => (
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
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {/* Referencia de la inversión inicial: por encima se gana, por debajo se pierde. */}
        {SERIES_BASE >= lo && SERIES_BASE <= hi && (
          <line
            x1={PAD.left}
            y1={yOf(SERIES_BASE)}
            x2={W - PAD.right}
            y2={yOf(SERIES_BASE)}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Guía vertical del punto inspeccionado */}
        {hovered !== null && (
          <line
            x1={xOf(activeYear)}
            y1={PAD.top}
            x2={xOf(activeYear)}
            y2={PAD.top + PLOT_H}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Las trayectorias */}
        {series.map((line) => (
          <path
            key={line.ticker}
            d={line.points
              .map((point, i) => `${i === 0 ? "M" : "L"} ${xOf(point.year)},${yOf(point.value)}`)
              .join(" ")}
            fill="none"
            stroke={line.color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Punto de cada serie en la posición activa */}
        {series.map((line) => (
          <circle
            key={`dot-${line.ticker}`}
            cx={xOf(activeYear)}
            cy={yOf(line.points[activeIndex].value)}
            r={3.5}
            fill={line.color}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}

        {/* Etiquetas del eje X */}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={xOf(tick)}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize={10}
          >
            {formatTime ? formatTime(tick) : tick === 0 ? "Hoy" : `${tick}a`}
          </text>
        ))}
      </svg>
    </div>
  );
}
