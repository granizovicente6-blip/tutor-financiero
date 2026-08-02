import type { ReactNode } from "react";
import { SERIES_BASE, type SeriesPoint } from "@/lib/market-series";

// ---------------------------------------------------------------------------
// Mini-gráfico de una tarjeta del catálogo (SVG puro, sin ejes ni interacción).
//
// No pretende que se lea ninguna cifra: su trabajo es que, de un vistazo, la
// FORMA de un instrumento de riesgo bajo se distinga de uno muy alto. Las
// cifras están en el gráfico grande de la ficha.
// ---------------------------------------------------------------------------

const W = 240;
const H = 44;
const PAD_Y = 4;

/**
 * Amplitud mínima del eje vertical, en puntos de la base 100.
 *
 * Sin ella, cada tarjeta se escalaría a su propio rango y un instrumento de
 * riesgo bajo llenaría la caja igual que uno muy alto: el mini-gráfico diría
 * exactamente lo contrario de lo que quiere enseñar. Con un mínimo común, una
 * serie que apenas se mueve se dibuja plana y solo las volátiles ocupan todo el
 * alto. Las que superan este rango siguen escalándose a sí mismas, así que
 * nunca se recorta ninguna trayectoria.
 */
const MIN_SPAN = 90;

interface SparklineProps {
  points: SeriesPoint[];
  color: string;
  /** Clave única en la página (el ticker): aísla el `id` del degradado. */
  idKey: string;
  /** Descripción para lectores de pantalla. */
  label: string;
}

export function Sparkline({ points, color, idKey, label }: SparklineProps): ReactNode {
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  // La escala se centra en el rango recorrido y se ensancha hasta `MIN_SPAN`:
  // así la altura del dibujo es proporcional a cuánto se movió de verdad.
  const lowest = Math.min(...values, SERIES_BASE);
  const highest = Math.max(...values, SERIES_BASE);
  const span = Math.max(highest - lowest, MIN_SPAN);
  const min = (lowest + highest) / 2 - span / 2;
  const lastYear = points[points.length - 1].year || 1;

  const xOf = (year: number): number => (year / lastYear) * W;
  const yOf = (value: number): number =>
    H - PAD_Y - ((value - min) / span) * (H - PAD_Y * 2);

  const line = points
    .map((point, i) => `${i === 0 ? "M" : "L"} ${xOf(point.year)},${yOf(point.value)}`)
    .join(" ");

  // El área bajo la curva solo da cuerpo visual: se corta en el borde inferior.
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const gradientId = `spark-${idKey.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Línea de la inversión inicial (base 100) como referencia muda. */}
      <line
        x1={0}
        y1={yOf(SERIES_BASE)}
        x2={W}
        y2={yOf(SERIES_BASE)}
        stroke="#cbd5e1"
        strokeWidth={1}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
