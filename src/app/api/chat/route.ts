import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/tutor-prompt";
import { API_ROUTES, enforceRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import type { ChatMessage, FinancialLevel } from "@/lib/types";

/**
 * API Route: POST /api/chat
 *
 * Flujo (con persistencia en Supabase):
 *  1. Autentica al usuario (sesión de Supabase). Sin sesión -> 401.
 *  2. Determina la conversación: usa la existente (verificando propiedad vía
 *     RLS) o crea una nueva con título derivado del primer mensaje.
 *  3. Carga el historial desde la BD (fuente de verdad, no se confía en el
 *     cliente) y guarda el nuevo mensaje del usuario.
 *  4. Transmite la respuesta de Claude en tiempo real (streaming).
 *  5. Al terminar el stream, guarda el mensaje del asistente.
 *
 * Devuelve el id de la conversación en la cabecera `X-Conversation-Id` para que
 * el cliente pueda actualizar la URL / barra lateral en chats nuevos.
 */

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

// Ventana deslizante: nº máximo de mensajes previos que se envían como contexto
// a Claude (controla el consumo de tokens en conversaciones largas).
const HISTORY_WINDOW = 20;

// Modelo económico y rápido, solo para generar títulos de conversación.
const TITLE_MODEL = "claude-haiku-4-5";

/**
 * Genera un título breve (máx. ~6 palabras) a partir de la primera pregunta
 * del usuario. Devuelve null si falla; el llamador conserva entonces el título
 * de respaldo (el mensaje recortado). Se ejecuta en paralelo al stream para no
 * añadir latencia perceptible.
 */
async function generateTitle(
  anthropic: Anthropic,
  firstMessage: string,
): Promise<string | null> {
  try {
    const res = await anthropic.messages.create({
      model: TITLE_MODEL,
      max_tokens: 30,
      messages: [
        {
          role: "user",
          content: `Genera un título muy breve (máximo 6 palabras, en español, sin comillas ni punto final) que resuma el tema de esta primera pregunta de un estudiante a su tutor de finanzas:\n\n"${firstMessage}"\n\nResponde ÚNICAMENTE con el título.`,
        },
      ],
    });
    const textBlock = res.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    // Limpia comillas/espacios/punto final envolventes.
    const cleaned = textBlock.text.trim().replace(/^["'«»\s]+|["'«».\s]+$/g, "");
    return cleaned.length > 0 ? cleaned.slice(0, 60) : null;
  } catch (error) {
    console.error("[api/chat] No se pudo generar el título:", error);
    return null;
  }
}

interface ChatRequestBody {
  conversationId?: string | null;
  content: string;
}

function isValidBody(body: unknown): body is ChatRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const { content, conversationId } = body as Record<string, unknown>;
  if (typeof content !== "string" || content.trim() === "") return false;
  if (
    conversationId !== undefined &&
    conversationId !== null &&
    typeof conversationId !== "string"
  ) {
    return false;
  }
  return true;
}

/** Traduce cualquier error a una respuesta HTTP JSON limpia. */
function toErrorResponse(error: unknown): Response {
  console.error("[api/chat] Error al invocar a Claude:", error);
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

  // Rate limiting por usuario (protege el gasto de la API de IA).
  const rate = await enforceRateLimit(supabase, API_ROUTES.chat);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter);
  }

  // Nivel de conocimiento del estudiante (para adaptar la pedagogía del tutor).
  const { data: profile } = await supabase
    .from("profiles")
    .select("financial_level")
    .eq("id", user.id)
    .maybeSingle();
  const financialLevel = (profile?.financial_level ?? null) as FinancialLevel | null;

  // 2. Validar cuerpo.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return Response.json(
      { error: "Formato inválido. Se espera { conversationId?, content: string }." },
      { status: 400 },
    );
  }

  const content = body.content.trim();

  // 3. Determinar conversación y cargar historial.
  let conversationId: string;
  let history: ChatMessage[] = [];
  let isNewConversation = false;

  if (body.conversationId) {
    // Verificar propiedad (RLS: si no es del usuario, no devuelve fila).
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", body.conversationId)
      .maybeSingle();

    if (!conv) {
      return Response.json({ error: "Conversación no encontrada." }, { status: 404 });
    }
    conversationId = conv.id;

    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    history = (msgs ?? []).map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));
  } else {
    // Nueva conversación: título de respaldo = primeras palabras del mensaje
    // (se reemplazará por un título generado por IA al terminar el stream).
    const fallbackTitle = content.slice(0, 60);
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: fallbackTitle })
      .select("id")
      .single();

    if (error || !conv) {
      return Response.json({ error: "No se pudo crear la conversación." }, { status: 500 });
    }
    conversationId = conv.id;
    isNewConversation = true;
  }

  // Guardar el mensaje del usuario.
  const { error: userInsertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content });
  if (userInsertError) {
    return Response.json({ error: "No se pudo guardar el mensaje." }, { status: 500 });
  }

  // 4. Preparar contexto para Claude (ventana deslizante) e iniciar streaming.
  const apiMessages: ChatMessage[] = [
    ...history.slice(-HISTORY_WINDOW),
    { role: "user", content },
  ];

  const anthropic = new Anthropic({ apiKey });

  // Generación del título en paralelo (solo para conversaciones nuevas), de
  // modo que termine mientras se transmite la respuesta principal.
  const titlePromise = isNewConversation ? generateTitle(anthropic, content) : null;

  const claudeStream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(financialLevel),
    messages: apiMessages,
  });
  claudeStream.on("error", () => {});

  const iterator = claudeStream[Symbol.asyncIterator]();

  // "Peek" del primer evento para capturar errores de conexión/auth antes de
  // comprometernos a una respuesta 200 en streaming.
  let firstResult: IteratorResult<Anthropic.MessageStreamEvent>;
  try {
    firstResult = await iterator.next();
  } catch (connectionError) {
    return toErrorResponse(connectionError);
  }

  const encoder = new TextEncoder();
  let assistantText = "";

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let result = firstResult;
        while (!result.done) {
          const event = result.value;
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
          result = await iterator.next();
        }
      } catch (streamError) {
        controller.error(streamError);
        return;
      }

      // 5. Persistir la respuesta del asistente al completar el stream.
      if (assistantText.length > 0) {
        const { error: assistantInsertError } = await supabase
          .from("messages")
          .insert({ conversation_id: conversationId, role: "assistant", content: assistantText });
        if (assistantInsertError) {
          console.error("[api/chat] No se pudo guardar la respuesta:", assistantInsertError);
        }
      }

      // Reemplazar el título de respaldo por el generado por IA (si lo hay).
      if (titlePromise) {
        const generatedTitle = await titlePromise;
        if (generatedTitle) {
          const { error: titleError } = await supabase
            .from("conversations")
            .update({ title: generatedTitle })
            .eq("id", conversationId);
          if (titleError) {
            console.error("[api/chat] No se pudo actualizar el título:", titleError);
          }
        }
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
      "X-Conversation-Id": conversationId,
    },
  });
}
