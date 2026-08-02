// =============================================================================
// Series de evolución para el catálogo de instrumentos — SIMULACIÓN educativa
//
// La plataforma no consume datos de mercado en vivo (ver la cabecera de
// `lib/instruments.ts`): no hay precios ni rentabilidades históricas y prometer
// cifras sería falso. Pero sí se puede enseñar lo que la etiqueta de riesgo
// significa, que es lo que este módulo dibuja: cómo se MUEVE en el tiempo una
// inversión según su volatilidad esperada.
//
// Por eso las series de aquí:
//   - Empiezan siempre en base 100 (no en un precio), para que se lean como
//     "cuánto se mueve", no como "cuánto vale".
//   - Salen de un modelo público y explicado (movimiento browniano geométrico)
//     con supuestos que la interfaz muestra al usuario.
//   - Son DETERMINISTAS: la semilla es el propio ticker, así que el mismo
//     instrumento dibuja siempre la misma trayectoria. Eso evita que el gráfico
//     baile en cada render y, sobre todo, que el HTML del servidor y el del
//     cliente difieran (`Math.random()` rompería la hidratación).
//
// NUNCA presentar estas cifras como desempeño real de un fondo.
// =============================================================================

import type { RiskLevel } from "@/lib/instruments";

/** Un punto de la trayectoria: `year` puede ser fraccionario (pasos mensuales). */
export interface SeriesPoint {
  /** Años transcurridos desde hoy (0 = hoy). */
  year: number;
  /** Valor de la inversión, en base 100. */
  value: number;
}

/** Valor inicial de toda serie: 100 unidades invertidas "hoy". */
export const SERIES_BASE = 100;

/** Pasos por año del modelo. Mensual: suficiente detalle sin ruido excesivo. */
const STEPS_PER_YEAR = 12;

/**
 * Tendencia anual, en términos reales, IGUAL para todos los instrumentos.
 *
 * Es deliberado que no dependa del riesgo: si a más riesgo le pusiéramos más
 * retorno, el gráfico estaría afirmando "arriesga más y ganarás más", que es
 * justo lo que no se puede prometer. Con una tendencia común, lo único que
 * distingue a un instrumento de otro en pantalla es su VOLATILIDAD, que es lo
 * que la etiqueta de riesgo del catálogo mide.
 */
export const TREND_PER_YEAR = 0.03;

/**
 * Volatilidad anual supuesta por perfil de riesgo. Parámetros didácticos
 * redondeados: no son la volatilidad medida de ningún fondo concreto.
 */
export const RISK_VOLATILITY: Record<RiskLevel, number> = {
  bajo: 0.05,
  moderado: 0.15,
  alto: 0.25,
  "muy alto": 0.38,
};

/**
 * Fuerza con la que la trayectoria vuelve hacia su tendencia (por año).
 *
 * Sin ella, un paseo aleatorio de diez años sobre un instrumento volátil puede
 * terminar multiplicándose por diez o cayendo un 80%. Aunque eso es lo que un
 * modelo libre produce, dibujado bajo el nombre de un fondo REAL se leería como
 * un pronóstico sobre ese fondo. Acotar la deriva mantiene el gráfico en su
 * papel: enseñar la forma del riesgo, no anticipar un resultado.
 */
const REVERSION = 0.8;

/** Paleta de las series superpuestas (hasta cuatro a la vez). */
export const SERIES_COLORS = ["#0284c7", "#059669", "#d97706", "#7c3aed"] as const;

/**
 * Color del mini-gráfico de cada tarjeta, por nivel de riesgo.
 *
 * Son los mismos tonos que los distintivos de `RISK_META`, pero en hexadecimal:
 * el SVG pinta con `stroke`/`fill`, no con clases de Tailwind.
 */
export const RISK_COLORS: Record<RiskLevel, string> = {
  bajo: "#10b981",
  moderado: "#0ea5e9",
  alto: "#f59e0b",
  "muy alto": "#ef4444",
};

// ---------------------------------------------------------------------------
// Generador determinista
// ---------------------------------------------------------------------------

/** Hash FNV-1a del ticker: convierte "VOO" en una semilla estable de 32 bits. */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** PRNG mulberry32: rápido, sin dependencias y reproducible en ambos entornos. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal estándar por Box-Muller a partir de un uniforme (0,1). */
function standardNormal(random: () => number): number {
  // `1 - random()` evita el 0 exacto, que haría explotar el logaritmo.
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

/**
 * Trayectoria simulada de una inversión de 100 según su perfil de riesgo.
 *
 * Tendencia común más una desviación con reversión a la media (proceso de
 * Ornstein-Uhlenbeck) en escala logarítmica, con pasos mensuales:
 *
 *   x(t+dt) = x(t) − θ·x(t)·dt + σ·√dt·Z
 *   V(t)    = 100 · exp(tendencia·t + x(t))
 *
 * Como la semilla depende solo del ticker y los pasos se recorren en orden, una
 * serie de 3 años es exactamente el prefijo de la de 10: el mini-gráfico de la
 * tarjeta y el gráfico grande de la ficha cuentan la misma historia.
 */
export function simulateSeries(
  ticker: string,
  risk: RiskLevel,
  years: number,
): SeriesPoint[] {
  const volatility = RISK_VOLATILITY[risk];
  const random = mulberry32(seedFrom(ticker));
  const dt = 1 / STEPS_PER_YEAR;
  const steps = Math.max(1, Math.round(years * STEPS_PER_YEAR));

  const points: SeriesPoint[] = [{ year: 0, value: SERIES_BASE }];
  /** Desviación (logarítmica) respecto de la tendencia. */
  let deviation = 0;

  for (let step = 1; step <= steps; step += 1) {
    const shock = standardNormal(random);
    deviation +=
      -REVERSION * deviation * dt + volatility * Math.sqrt(dt) * shock;
    const year = step * dt;
    points.push({ year, value: SERIES_BASE * Math.exp(TREND_PER_YEAR * year + deviation) });
  }

  return points;
}

/** Variación porcentual de un punto respecto de la base 100. */
export function changeFromBase(value: number): number {
  return ((value - SERIES_BASE) / SERIES_BASE) * 100;
}

const PERCENT_FORMAT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "+43,2%" / "−12,0%" — el signo siempre visible. */
export function formatChange(percent: number): string {
  const rounded = Math.abs(percent) < 0.05 ? 0 : percent;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${PERCENT_FORMAT.format(Math.abs(rounded))}%`;
}

/** Frase con el supuesto de volatilidad del perfil, para el pie del gráfico. */
export function assumptionsLabel(risk: RiskLevel): string {
  return `${Math.round(RISK_VOLATILITY[risk] * 100)}% de volatilidad anual`;
}
