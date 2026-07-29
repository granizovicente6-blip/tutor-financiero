import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/tutor-prompt";
import { API_ROUTES, enforceRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { logEvent } from "@/lib/analytics";
import { getLessonBySlug } from "@/lib/curriculum";
import type { FinancialLevel, QuizQuestionResult, QuizResult } from "@/lib/types";

/**
 * API Route: POST /api/quiz/feedback
 *
 * Flujo:
 *  1. Autentica al usuario (sin sesión -> 401).
 *  2. Valida lessonId + respuestas contra el currículum en código.
 *  3. CALIFICA en el servidor (autoridad; no confía en el cliente) y guarda
 *     `quiz_score` + `status='completed'` en lesson_progress (UPSERT).
 *  4. Transmite (streaming) la retroalimentación socrática del tutor, adaptada
 *     al nivel del estudiante.
 *
 * Devuelve el resultado calculado en la cabecera `X-Quiz-Result` (JSON) para que
 * el cliente pinte aciertos/errores y el puntaje mientras llega el feedback.
 */

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

interface QuizFeedbackBody {
  lessonId: string;
  answers: number[];
}

function isValidBody(body: unknown): body is QuizFeedbackBody {
  if (typeof body !== "object" || body === null) return false;
  const { lessonId, answers } = body as Record<string, unknown>;
  if (typeof lessonId !== "string" || lessonId.trim() === "") return false;
  if (!Array.isArray(answers)) return false;
  return answers.every((a) => typeof a === "number" && Number.isInteger(a));
}

function toErrorResponse(error: unknown): Response {
  console.error("[api/quiz/feedback] Error:", error);
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
  const rate = await enforceRateLimit(supabase, API_ROUTES.quizFeedback);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter);
  }

  // 2. Validar cuerpo.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return Response.json(
      { error: "Formato inválido. Se espera { lessonId: string, answers: number[] }." },
      { status: 400 },
    );
  }

  // Resolver la lección y su quiz desde el currículum (fuente de verdad).
  const found = getLessonBySlug(body.lessonId);
  const lesson = found?.lesson;
  const quiz = lesson?.quiz;
  if (!lesson || !quiz || quiz.length === 0) {
    return Response.json({ error: "La lección no tiene quiz." }, { status: 404 });
  }

  if (body.answers.length !== quiz.length) {
    return Response.json(
      { error: "El número de respuestas no coincide con el del quiz." },
      { status: 400 },
    );
  }

  // 3. Calificar en el servidor (autoridad).
  const perQuestion: QuizQuestionResult[] = quiz.map((q, i) => {
    const selectedIndex = body.answers[i];
    return {
      id: q.id,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect: selectedIndex === q.correctIndex,
    };
  });
  const correctCount = perQuestion.filter((r) => r.isCorrect).length;
  const total = quiz.length;
  const score = Math.round((correctCount / total) * 100);
  const result: QuizResult = { score, correctCount, total, perQuestion };

  // Guardar puntaje + marcar la lección como completada (UPSERT).
  const { error: upsertError } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lesson.slug,
      status: "completed",
      quiz_score: score,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (upsertError) {
    console.error("[api/quiz/feedback] No se pudo guardar el puntaje:", upsertError);
    return Response.json({ error: "No se pudo guardar el puntaje." }, { status: 500 });
  }

  // Resolver un quiz cuenta como "día activo" para la racha (atómico en la BD).
  const { error: streakError } = await supabase.rpc("touch_streak");
  if (streakError) {
    console.error("[api/quiz/feedback] No se pudo actualizar la racha:", streakError);
  }

  // Evento de analítica (tasa de finalización de quizzes).
  await logEvent(supabase, user.id, "quiz_completed", {
    lesson_id: lesson.slug,
    score,
    correct: correctCount,
    total,
  });

  // Nivel del estudiante para adaptar la retroalimentación.
  const { data: profile } = await supabase
    .from("profiles")
    .select("financial_level")
    .eq("id", user.id)
    .maybeSingle();
  const financialLevel = (profile?.financial_level ?? null) as FinancialLevel | null;

  // 4. Construir el mensaje para el tutor y transmitir el feedback.
  const detail = quiz
    .map((q, i) => {
      const sel = body.answers[i];
      const selText = q.options[sel] ?? "(sin responder)";
      const ok = sel === q.correctIndex;
      return `Pregunta ${i + 1}: ${q.prompt}\n- Respondió: "${selText}" (${ok ? "correcta" : "incorrecta"})\n- Correcta: "${q.options[q.correctIndex]}"`;
    })
    .join("\n\n");

  const userMessage = `El estudiante acaba de completar el quiz de la lección "${lesson.title}".
Obtuvo ${correctCount} de ${total} respuestas correctas (${score}%).

Detalle de sus respuestas:
${detail}

Escribe una retroalimentación breve (máximo 2 párrafos cortos), cálida y en tono socrático:
- Reconoce lo que acertó y explica brevemente por qué está bien.
- Para cada error, aclara el concepto con una analogía cotidiana, sin regañar.
- Cierra con una pregunta o mini-reto que lo invite a seguir pensando.
No des recomendaciones de inversión ni promesas de rentabilidad. Dirígete al estudiante en segunda persona (tú).`;

  const anthropic = new Anthropic({ apiKey });

  const claudeStream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(financialLevel),
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
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
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
      "X-Quiz-Result": JSON.stringify(result),
    },
  });
}
