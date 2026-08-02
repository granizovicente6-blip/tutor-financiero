import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildInstrumentAnalysisPrompt } from "@/lib/tutor-prompt";
import { API_ROUTES, enforceRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { logEvent } from "@/lib/analytics";
import { getSubscription, hasPremiumAccess } from "@/lib/subscription";
import { getInstrumentByTicker } from "@/lib/instruments";
import type { FinancialLevel } from "@/lib/types";

/**
 * API Route: POST /api/instruments/analyze
 *
 * Genera el desglose educativo (¿Qué es? / Pros / Contras / Perfil) de un ETF o
 * acción del catálogo y lo transmite en streaming.
 *
 * Flujo:
 *  1. Autentica al usuario (sin sesión -> 401).
 *  2. MURO DE PAGO: exige membresía activa (sin ella -> 403 `premium_required`).
 *     Esta es la barrera real; el modal del cliente es solo la señal visual.
 *  3. Rate limiting por usuario (protege el gasto de la API de IA).
 *  4. Valida el ticker CONTRA EL CATÁLOGO en código: solo se analiza lo que
 *     existe ahí, para que el endpoint no sea un generador de texto libre.
 *  5. Transmite el análisis adaptado al nivel del estudiante.
 */

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1200;

interface AnalyzeBody {
  ticker: string;
}

function isValidBody(body: unknown): body is AnalyzeBody {
  if (typeof body !== "object" || body === null) return false;
  const { ticker } = body as Record<string, unknown>;
  return typeof ticker === "string" && ticker.trim() !== "";
}

function toErrorResponse(error: unknown): Response {
  console.error("[api/instruments/analyze] Error:", error);
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 500;
    let message = "Error al comunicarse con el modelo de IA.";
    if (status === 401) {
      message = "Error de autenticación con el modelo de IA. Revisa ANTHROPIC_API_KEY.";
    } else if (status === 429) {
      message = "Se ha alcanzado el límite de solicitudes. Inténtalo en unos segundos.";
    }
    return Response.json({ error: message }, { status });
  }
  return Response.json({ error: "Error interno del servidor." }, { status: 500 });
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Configuración del servidor incompleta: falta ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  // 1. Autenticación.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  // 2. Validar cuerpo y resolver el instrumento en el catálogo.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return Response.json(
      { error: "Formato inválido. Se espera { ticker: string }." },
      { status: 400 },
    );
  }

  const instrument = getInstrumentByTicker(body.ticker);
  if (!instrument) {
    return Response.json(
      { error: "El instrumento no está en el catálogo." },
      { status: 404 },
    );
  }

  // 3. Muro de pago (fail-closed: `getSubscription` devuelve 'free' ante errores).
  const subscription = await getSubscription(supabase, user.id);
  if (!hasPremiumAccess(subscription)) {
    await logEvent(supabase, user.id, "instrument_paywall_hit", {
      ticker: instrument.ticker,
    });
    return Response.json(
      {
        error: "El análisis de mercado con IA forma parte de la Membresía Premium.",
        code: "premium_required",
      },
      { status: 403 },
    );
  }

  // 4. Rate limiting por usuario (protege el gasto de la API de IA).
  const rate = await enforceRateLimit(supabase, API_ROUTES.instrumentAnalysis);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter);
  }

  // Nivel del estudiante, para adaptar la profundidad del análisis.
  const { data: profile } = await supabase
    .from("profiles")
    .select("financial_level")
    .eq("id", user.id)
    .maybeSingle();
  const financialLevel = (profile?.financial_level ?? null) as FinancialLevel | null;

  await logEvent(supabase, user.id, "instrument_analyzed", {
    ticker: instrument.ticker,
    category: instrument.category,
  });

  // 5. Construir el mensaje y transmitir el análisis.
  //
  // Los datos del catálogo se envían como contexto para que el modelo parta de
  // la misma ficha que ve el estudiante y no invente el tipo de instrumento.
  const userMessage = `Prepara el desglose educativo de este instrumento del catálogo de la plataforma:

- Símbolo: ${instrument.ticker}
- Nombre: ${instrument.name}
- Tipo: ${instrument.kind}
- Categoría: ${instrument.category}
- Emisor / sector: ${instrument.issuer}
- Nivel de riesgo asignado en el catálogo: ${instrument.risk}
- Descripción de la ficha: ${instrument.description}

Sigue exactamente el formato de cuatro secciones indicado en tus instrucciones.`;

  const anthropic = new Anthropic({ apiKey });

  const claudeStream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildInstrumentAnalysisPrompt(financialLevel),
    messages: [{ role: "user", content: userMessage }],
  });
  claudeStream.on("error", () => {});

  const iterator = claudeStream[Symbol.asyncIterator]();

  // "Peek" del primer evento para capturar errores de conexión antes del 200.
  let firstResult: IteratorResult<Anthropic.MessageStreamEvent>;
  try {
    firstResult = await iterator.next();
  } catch (connectionError) {
    return toErrorResponse(connectionError);
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let step = firstResult;
        while (!step.done) {
          const event = step.value;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
          step = await iterator.next();
        }
      } catch (streamError) {
        controller.error(streamError);
        return;
      }
      controller.close();
    },
    cancel() {
      claudeStream.abort();
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Instrument-Ticker": instrument.ticker,
    },
  });
}
