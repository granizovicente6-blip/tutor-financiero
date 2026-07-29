import type { ReactNode } from "react";
import type { YearPoint } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Gráfico de crecimiento (SVG puro, sin dependencias).
//
// Muestra el saldo acumulado en el tiempo como área apilada:
//   - banda inferior (slate)  = capital aportado
//   - banda superior (emerald)= intereses generados
// La suma de ambas es el saldo total, resaltado con una línea y un punto final.
// Es responsive vía viewBox: escala al ancho del contenedor.
// ---------------------------------------------------------------------------

const W = 520;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };
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

/** Formato compacto para etiquetas de eje (1.2M, 340k, …). */
function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}

interface GrowthChartProps {
  series: YearPoint[];
}

export function GrowthChart({ series }: GrowthChartProps): ReactNode {
  const maxYear = Math.max(1, series[series.length - 1]?.year ?? 1);
  const maxBalance = Math.max(...series.map((p) => p.balance), 1);
  const yMax = niceCeil(maxBalance);

  const xOf = (year: number): number => PAD.left + (year / maxYear) * PLOT_W;
  const yOf = (value: number): number => PAD.top + PLOT_H - (value / yMax) * PLOT_H;

  const baseline = yOf(0);

  // Área del capital aportado (de 0 a contributed).
  const contributedArea =
    `M ${xOf(series[0].year)},${baseline} ` +
    series.map((p) => `L ${xOf(p.year)},${yOf(p.contributed)}`).join(" ") +
    ` L ${xOf(series[series.length - 1].year)},${baseline} Z`;

  // Área de intereses (entre la curva de aportes y la del saldo total).
  const interestArea =
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.year)},${yOf(p.balance)}`).join(" ") +
    " " +
    [...series]
      .reverse()
      .map((p) => `L ${xOf(p.year)},${yOf(p.contributed)}`)
      .join(" ") +
    " Z";

  // Línea del saldo total.
  const balanceLine = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.year)},${yOf(p.balance)}`)
    .join(" ");

  // Ticks del eje Y (0, ¼, ½, ¾, máx).
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  // Etiquetas del eje X: hasta ~6 marcas repartidas.
  const step = Math.max(1, Math.round(maxYear / 6));
  const xTicks: number[] = [];
  for (let y = 0; y <= maxYear; y += step) xTicks.push(y);
  if (xTicks[xTicks.length - 1] !== maxYear) xTicks.push(maxYear);

  const last = series[series.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Gráfico de crecimiento del ahorro en el tiempo"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Rejilla horizontal + etiquetas Y */}
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

      {/* Áreas apiladas */}
      <path d={contributedArea} fill="#cbd5e1" fillOpacity={0.7} />
      <path d={interestArea} fill="#34d399" fillOpacity={0.55} />

      {/* Línea de saldo total */}
      <path d={balanceLine} fill="none" stroke="#059669" strokeWidth={2} />

      {/* Punto final */}
      <circle cx={xOf(last.year)} cy={yOf(last.balance)} r={3.5} fill="#059669" />

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
          {tick === 0 ? "Hoy" : `${tick}a`}
        </text>
      ))}
    </svg>
  );
}
