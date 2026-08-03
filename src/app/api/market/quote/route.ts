import { createClient } from "@/lib/supabase/server";
import { API_ROUTES, enforceRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { getInstrumentByTicker } from "@/lib/instruments";
import { getMarketSnapshot } from "@/lib/market";
import { DEFAULT_RANGE, isHistoryRange } from "@/lib/market-format";

/**
 * API Route: GET /api/market/quote?ticker=AAPL&range=1A
 *
 * Devuelve precio reciente, fundamentales e historial de cierres de un
 * instrumento del catálogo.
 *
 * Decisiones:
 *  - La ruta existe para que la clave del proveedor NO salga del servidor. El
 *    navegador nunca habla directamente con el proveedor de datos.
 *  - El ticker se valida contra el catálogo en código, igual que en el análisis
 *    con IA: el endpoint no es un proxy abierto a cualquier símbolo.
 *  - NO exige membresía. El muro de pago cubre el análisis con IA, que es lo
 *    que cuesta tokens; una cotización es un dato público y dejarlo a la vista
 *    es justamente lo que hace útil la sección para el plan gratuito.
 *  - Nunca devuelve cifras estimadas: lo que el proveedor no entrega vuelve
 *    como `null` con su motivo en `notes` (ver `lib/market.ts`).
 */

export async function GET(req: Request): Promise<Response> {
  // 1. Autenticación (defensa en profundidad además del middleware).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  // 2. Validar el ticker CONTRA EL CATÁLOGO.
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  const instrument = getInstrumentByTicker(ticker);
  if (!instrument) {
    return Response.json(
      { error: "El instrumento no está en el catálogo." },
      { status: 404 },
    );
  }

  const rangeParam = url.searchParams.get("range");
  const range = isHistoryRange(rangeParam) ? rangeParam : DEFAULT_RANGE;

  // 3. Rate limiting por usuario (protege la cuota del proveedor de datos).
  const rate = await enforceRateLimit(supabase, API_ROUTES.marketQuote);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter);
  }

  const snapshot = await getMarketSnapshot(instrument.ticker, range);

  return Response.json(
    { ...snapshot, range },
    { headers: { "Cache-Control": "no-store" } },
  );
}
