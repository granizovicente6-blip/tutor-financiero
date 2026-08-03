// =============================================================================
// Datos de mercado: opciones de rango y presentación
//
// Módulo PURO y sin secretos: no hace peticiones ni lee variables de entorno,
// así que lo pueden importar tanto las rutas de API como los componentes de
// cliente. Todo lo que toca la red y la clave del proveedor vive en
// `lib/market.ts`, que es solo de servidor.
//
// Regla de oro de este archivo: cuando un dato no está, se devuelve "—" y se
// explica por qué. NUNCA se rellena con una estimación: una cifra financiera
// inventada es peor que un hueco.
// =============================================================================

/** Rangos ofrecidos por el gráfico de rendimiento de la ficha. */
export const HISTORY_RANGES = [
  { key: "1M", label: "1 mes", days: 30 },
  { key: "6M", label: "6 meses", days: 182 },
  { key: "1A", label: "1 año", days: 365 },
  { key: "5A", label: "5 años", days: 1826 },
] as const;

export type HistoryRangeKey = (typeof HISTORY_RANGES)[number]["key"];

/** Rango por defecto al abrir una ficha. */
export const DEFAULT_RANGE: HistoryRangeKey = "1A";

export function isHistoryRange(value: unknown): value is HistoryRangeKey {
  return HISTORY_RANGES.some((range) => range.key === value);
}

/** Días de historia que cubre un rango. */
export function daysForRange(key: HistoryRangeKey): number {
  return HISTORY_RANGES.find((range) => range.key === key)?.days ?? 365;
}

// ---------------------------------------------------------------------------
// Motivos por los que un dato puede faltar
// ---------------------------------------------------------------------------

/**
 * Por qué no se pudo traer un bloque de datos. La interfaz lo muestra tal cual
 * para que el estudiante sepa que falta un dato, no que el dato sea cero.
 */
export type MarketDataIssue =
  | "not_configured"
  | "unsupported"
  | "plan_restricted"
  | "rate_limited"
  | "provider_error";

const ISSUE_MESSAGES: Record<MarketDataIssue, string> = {
  not_configured:
    "Los datos de mercado en vivo no están configurados en este entorno.",
  unsupported: "El proveedor no publica este dato para este instrumento.",
  plan_restricted: "Este dato no está incluido en el plan del proveedor de datos.",
  rate_limited: "Se alcanzó el límite del proveedor de datos. Inténtalo en un minuto.",
  provider_error: "No se pudo contactar al proveedor de datos de mercado.",
};

export function describeIssue(issue: MarketDataIssue): string {
  return ISSUE_MESSAGES[issue];
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/** Marcador de dato ausente. Un guion largo, nunca un 0 ni un "N/D" ambiguo. */
export const NO_DATA = "—";

const DECIMAL_2 = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DECIMAL_1 = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "US$ 231,40". La moneda la informa el proveedor; no se convierte a pesos. */
export function formatPrice(value: number | null, currency = "USD"): string {
  if (!isNumber(value)) return NO_DATA;
  const symbol = currency === "USD" ? "US$" : `${currency} `;
  return `${symbol} ${DECIMAL_2.format(value)}`;
}

/** "+1,24%" / "−0,80%" — el signo siempre visible, como en `market-series`. */
export function formatSignedPercent(value: number | null): string {
  if (!isNumber(value)) return NO_DATA;
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${DECIMAL_2.format(Math.abs(rounded))}%`;
}

/**
 * Capitalización en palabras españolas: "billón" es 10^12 y "mil millones" es
 * 10^9. Se evita la abreviatura "B", que en inglés significa 10^9 y en español
 * 10^12: en una plataforma que enseña finanzas, esa ambigüedad no es aceptable.
 */
export function formatMarketCap(value: number | null, currency = "USD"): string {
  if (!isNumber(value) || value <= 0) return NO_DATA;
  const symbol = currency === "USD" ? "US$" : `${currency} `;
  if (value >= 1e12) return `${symbol} ${DECIMAL_2.format(value / 1e12)} billones`;
  if (value >= 1e9) return `${symbol} ${DECIMAL_1.format(value / 1e9)} mil millones`;
  if (value >= 1e6) return `${symbol} ${DECIMAL_1.format(value / 1e6)} millones`;
  return `${symbol} ${DECIMAL_2.format(value)}`;
}

/** Ratio P/E: "28,4". Un P/E negativo se muestra igual (la empresa pierde). */
export function formatRatio(value: number | null): string {
  if (!isNumber(value)) return NO_DATA;
  return DECIMAL_1.format(value);
}

/** Rentabilidad por dividendo: "0,45%". Sin signo (nunca es negativa). */
export function formatYield(value: number | null): string {
  if (!isNumber(value)) return NO_DATA;
  return `${DECIMAL_2.format(value)}%`;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "01 ago, 16:00" para el pie del panel de métricas.
 *
 * Se llama solo desde el navegador (los datos llegan tras un fetch), así que no
 * hay riesgo de que el HTML del servidor y el del cliente difieran por la zona
 * horaria.
 */
export function formatAsOf(iso: string | null): string {
  if (!iso) return NO_DATA;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NO_DATA;
  return DATE_TIME_FORMAT.format(date);
}
