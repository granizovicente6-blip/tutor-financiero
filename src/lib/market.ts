// =============================================================================
// Servicio de datos de mercado — cotizaciones REALES
//
// SOLO SERVIDOR: lee `FINNHUB_API_KEY` y la manda al proveedor. Nunca importar
// este módulo desde un componente de cliente; para tipos usa `import type`, que
// se borra al compilar, y para formatear usa `lib/market-format.ts`.
//
// Diferencia importante con `lib/market-series.ts`: aquel SIMULA trayectorias
// para enseñar qué significa la etiqueta de riesgo; este trae precios y ratios
// que existen de verdad. Los dos conviven porque cubren cosas distintas, y la
// interfaz debe dejar siempre claro cuál está mostrando.
//
// Contrato de fallo: este módulo NUNCA inventa ni estima un dato. Si el
// proveedor no lo entrega —porque falta la clave, porque el plan no lo incluye
// o porque el símbolo no está cubierto— devuelve `null` y un motivo en `notes`,
// y la interfaz muestra un hueco explicado. Una cifra financiera inventada, con
// el nombre de un instrumento real al lado, se leería como un dato de mercado.
// =============================================================================

import { daysForRange, type HistoryRangeKey, type MarketDataIssue } from "@/lib/market-format";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

/** Corte de la petición al proveedor: preferimos un hueco a una página colgada. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Caché en memoria del proceso. Es "mejor esfuerzo": en Vercel cada instancia
 * tiene la suya y se pierde al reciclarse. No sustituye a un caché compartido,
 * pero absorbe el caso frecuente (varios usuarios abriendo el mismo ETF) y
 * protege la cuota del plan gratuito del proveedor.
 */
const QUOTE_TTL_MS = 60_000; // 1 min: una cotización más vieja ya no es "reciente".
const FUNDAMENTALS_TTL_MS = 12 * 60 * 60 * 1000; // Cambian como mucho una vez al día.
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000; // Cierres diarios: no cambian intradía.

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Cotización reciente de un símbolo. */
export interface Quote {
  price: number;
  /** Variación absoluta respecto del cierre anterior. */
  change: number | null;
  /** Variación porcentual respecto del cierre anterior. */
  changePercent: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  /** Momento del dato según el proveedor, en ISO 8601. */
  asOf: string | null;
}

/** Métricas fundamentales. Cualquier campo puede faltar (los ETFs no tienen P/E). */
export interface Fundamentals {
  /** Capitalización bursátil en la moneda de cotización. */
  marketCap: number | null;
  /** Ratio precio / utilidad (TTM). */
  peRatio: number | null;
  /** Rentabilidad por dividendo, en porcentaje (0,45 = 0,45%). */
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
}

/** Un cierre diario. `date` en formato `YYYY-MM-DD`. */
export interface PricePoint {
  date: string;
  close: number;
}

/** Qué bloque falta y por qué. La interfaz lo traduce con `describeIssue`. */
export type MarketNotes = Partial<Record<"quote" | "fundamentals" | "history", MarketDataIssue>>;

/** Todo lo que la ficha de un instrumento necesita del mercado real. */
export interface MarketSnapshot {
  ticker: string;
  /** Moneda de cotización. El proveedor cubre plazas en USD. */
  currency: string;
  quote: Quote | null;
  fundamentals: Fundamentals | null;
  history: PricePoint[] | null;
  notes: MarketNotes;
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

function apiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key ? key : null;
}

/** True si el entorno tiene credenciales del proveedor de datos de mercado. */
export function isMarketDataConfigured(): boolean {
  return apiKey() !== null;
}

// ---------------------------------------------------------------------------
// Cliente del proveedor
// ---------------------------------------------------------------------------

/** Error con el motivo ya clasificado, para que la interfaz pueda explicarlo. */
class MarketDataError extends Error {
  constructor(readonly issue: MarketDataIssue, message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

function issueOf(error: unknown): MarketDataIssue {
  return error instanceof MarketDataError ? error.issue : "provider_error";
}

/**
 * GET contra el proveedor. La clave viaja como parámetro de consulta, así que
 * la URL completa NUNCA se registra: los mensajes de error usan solo `path`.
 */
async function finnhub<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new MarketDataError("not_configured", "Falta FINNHUB_API_KEY.");
  }

  const url = new URL(`${FINNHUB_BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set("token", key);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[market] Fallo de red en ${path}:`, error);
    throw new MarketDataError("provider_error", "No se pudo contactar al proveedor.");
  }

  if (response.status === 401) {
    throw new MarketDataError("not_configured", "Credencial del proveedor rechazada.");
  }
  // 403 en el plan gratuito significa "este endpoint es de pago", no "prohibido".
  if (response.status === 403) {
    throw new MarketDataError("plan_restricted", "Dato no incluido en el plan.");
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limited", "Límite del proveedor alcanzado.");
  }
  if (!response.ok) {
    throw new MarketDataError("provider_error", `Respuesta ${response.status} en ${path}.`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new MarketDataError("provider_error", `Respuesta ilegible en ${path}.`);
  }
}

// ---------------------------------------------------------------------------
// Caché en memoria
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------------

type RawMetrics = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Primer campo con valor entre varios candidatos.
 *
 * El proveedor publica el mismo concepto bajo nombres distintos según el tipo
 * de empresa (`peTTM`, `peBasicExclExtraTTM`, `peNormalizedAnnual`…), y no
 * siempre rellena todos. Se prueban en orden de preferencia.
 */
function pickMetric(metrics: RawMetrics, keys: string[]): number | null {
  for (const key of keys) {
    const value = numberOrNull(metrics[key]);
    if (value !== null) return value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cotización
// ---------------------------------------------------------------------------

interface RawQuote {
  c?: number; // current
  d?: number; // change
  dp?: number; // change percent
  pc?: number; // previous close
  o?: number;
  h?: number;
  l?: number;
  t?: number; // epoch en segundos
}

/**
 * Precio reciente. Devuelve `null` si el proveedor no cubre el símbolo: en ese
 * caso responde 200 con todos los campos en cero, que hay que distinguir de un
 * precio real (ningún instrumento cotiza a 0).
 */
export async function getQuote(symbol: string): Promise<Quote | null> {
  const cacheKey = `quote:${symbol}`;
  const cached = readCache<Quote | null>(cacheKey);
  if (cached !== undefined) return cached;

  const raw = await finnhub<RawQuote>("/quote", { symbol });
  const price = numberOrNull(raw.c);
  if (price === null || price === 0) {
    writeCache(cacheKey, null, QUOTE_TTL_MS);
    return null;
  }

  const quote: Quote = {
    price,
    change: numberOrNull(raw.d),
    changePercent: numberOrNull(raw.dp),
    previousClose: numberOrNull(raw.pc),
    open: numberOrNull(raw.o),
    high: numberOrNull(raw.h),
    low: numberOrNull(raw.l),
    asOf: raw.t ? new Date(raw.t * 1000).toISOString() : null,
  };
  writeCache(cacheKey, quote, QUOTE_TTL_MS);
  return quote;
}

// ---------------------------------------------------------------------------
// Fundamentales
// ---------------------------------------------------------------------------

interface RawMetricResponse {
  metric?: RawMetrics;
}

/**
 * Capitalización, P/E y rentabilidad por dividendo.
 *
 * Es normal que un ETF devuelva casi todo vacío: un fondo no tiene utilidades
 * propias, así que su P/E no existe. Eso no es un error, es el dato real, y la
 * ficha lo muestra como hueco.
 */
export async function getFundamentals(symbol: string): Promise<Fundamentals | null> {
  const cacheKey = `fundamentals:${symbol}`;
  const cached = readCache<Fundamentals | null>(cacheKey);
  if (cached !== undefined) return cached;

  const raw = await finnhub<RawMetricResponse>("/stock/metric", { symbol, metric: "all" });
  const metrics = raw.metric;
  if (!metrics || typeof metrics !== "object") {
    writeCache(cacheKey, null, FUNDAMENTALS_TTL_MS);
    return null;
  }

  // El proveedor publica la capitalización en MILLONES de la moneda de
  // cotización; aquí se normaliza a unidades para que el formateador decida
  // la escala que se muestra.
  const capInMillions = pickMetric(metrics, ["marketCapitalization"]);

  const fundamentals: Fundamentals = {
    marketCap: capInMillions === null ? null : capInMillions * 1e6,
    peRatio: pickMetric(metrics, ["peTTM", "peBasicExclExtraTTM", "peNormalizedAnnual"]),
    dividendYield: pickMetric(metrics, [
      "currentDividendYieldTTM",
      "dividendYieldIndicatedAnnual",
    ]),
    week52High: pickMetric(metrics, ["52WeekHigh"]),
    week52Low: pickMetric(metrics, ["52WeekLow"]),
  };

  writeCache(cacheKey, fundamentals, FUNDAMENTALS_TTL_MS);
  return fundamentals;
}

// ---------------------------------------------------------------------------
// Historial de cierres
// ---------------------------------------------------------------------------

interface RawCandles {
  c?: number[];
  t?: number[];
  s?: string;
}

/**
 * Cierres diarios del último tramo pedido.
 *
 * En el plan gratuito del proveedor este endpoint suele estar restringido y
 * responde 403; se propaga como `plan_restricted` para que la ficha lo diga y
 * caiga en el gráfico simulado, que sí está siempre disponible.
 */
export async function getHistory(symbol: string, days: number): Promise<PricePoint[] | null> {
  const cacheKey = `history:${symbol}:${days}`;
  const cached = readCache<PricePoint[] | null>(cacheKey);
  if (cached !== undefined) return cached;

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;

  const raw = await finnhub<RawCandles>("/stock/candle", {
    symbol,
    resolution: "D",
    from: String(from),
    to: String(to),
  });

  const closes = raw.c;
  const times = raw.t;
  if (raw.s !== "ok" || !Array.isArray(closes) || !Array.isArray(times)) {
    writeCache(cacheKey, null, HISTORY_TTL_MS);
    return null;
  }

  const points: PricePoint[] = [];
  const length = Math.min(closes.length, times.length);
  for (let i = 0; i < length; i += 1) {
    const close = numberOrNull(closes[i]);
    const time = numberOrNull(times[i]);
    if (close === null || close <= 0 || time === null) continue;
    points.push({ date: new Date(time * 1000).toISOString().slice(0, 10), close });
  }

  // Una serie de un solo punto no dibuja nada: se trata como ausencia de dato.
  const result = points.length >= 2 ? points : null;
  writeCache(cacheKey, result, HISTORY_TTL_MS);
  return result;
}

// ---------------------------------------------------------------------------
// Instantánea completa
// ---------------------------------------------------------------------------

/**
 * Los tres bloques de una ficha, en paralelo y de forma independiente: que
 * falle el historial no debe dejar sin precio al estudiante, así que cada
 * bloque se resuelve y se anota por separado.
 */
export async function getMarketSnapshot(
  ticker: string,
  range: HistoryRangeKey,
): Promise<MarketSnapshot> {
  const symbol = ticker.trim().toUpperCase();

  if (!isMarketDataConfigured()) {
    return {
      ticker: symbol,
      currency: "USD",
      quote: null,
      fundamentals: null,
      history: null,
      notes: {
        quote: "not_configured",
        fundamentals: "not_configured",
        history: "not_configured",
      },
    };
  }

  const [quoteResult, fundamentalsResult, historyResult] = await Promise.allSettled([
    getQuote(symbol),
    getFundamentals(symbol),
    getHistory(symbol, daysForRange(range)),
  ]);

  const notes: MarketNotes = {};

  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  if (quoteResult.status === "rejected") notes.quote = issueOf(quoteResult.reason);
  else if (quote === null) notes.quote = "unsupported";

  const fundamentals =
    fundamentalsResult.status === "fulfilled" ? fundamentalsResult.value : null;
  if (fundamentalsResult.status === "rejected") {
    notes.fundamentals = issueOf(fundamentalsResult.reason);
  } else if (fundamentals === null) {
    notes.fundamentals = "unsupported";
  }

  const history = historyResult.status === "fulfilled" ? historyResult.value : null;
  if (historyResult.status === "rejected") notes.history = issueOf(historyResult.reason);
  else if (history === null) notes.history = "unsupported";

  return { ticker: symbol, currency: "USD", quote, fundamentals, history, notes };
}
