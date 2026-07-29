"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { QuizQuestion } from "@/lib/curriculum";
import type { QuizResult } from "@/lib/types";

// Render compacto del feedback del tutor (mismo espíritu que el chat).
const feedbackMarkdown: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

interface QuizProps {
  lessonSlug: string;
  questions: QuizQuestion[];
  /** Puntaje previo (si ya lo había completado antes). */
  initialScore: number | null;
  /** Se llama al calificar, para que la lección quede "completada". */
  onCompleted: (score: number) => void;
}

export function Quiz({ lessonSlug, questions, initialScore, onCompleted }: QuizProps): ReactNode {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [result, setResult] = useState<QuizResult | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = answers.every((a) => a !== null);
  const submitted = result !== null;

  function selectOption(questionIndex: number, optionIndex: number): void {
    if (submitted || isLoading) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  function resetQuiz(): void {
    setAnswers(questions.map(() => null));
    setResult(null);
    setFeedback("");
    setError(null);
  }

  async function submitQuiz(): Promise<void> {
    if (!allAnswered || isLoading) return;
    setIsLoading(true);
    setError(null);
    setFeedback("");

    try {
      const response = await fetch("/api/quiz/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lessonSlug, answers }),
      });

      if (response.status === 429) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error ?? "Has alcanzado el límite de solicitudes. Espera unos segundos.",
        );
        return;
      }

      if (!response.ok || response.body === null) {
        throw new Error(`Respuesta no válida del servidor (${response.status}).`);
      }

      // El servidor calcula el puntaje (autoridad) y lo manda por cabecera.
      const header = response.headers.get("X-Quiz-Result");
      if (header) {
        const parsed = JSON.parse(header) as QuizResult;
        setResult(parsed);
        onCompleted(parsed.score);
      }

      // Feedback del tutor en streaming.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setFeedback(acc);
      }
    } catch (err) {
      console.error("[quiz] Error al enviar el quiz:", err);
      setError(
        "No se pudo generar la retroalimentación. Tu puntaje pudo guardarse; inténtalo de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">📝 Pon a prueba lo aprendido</h2>
        {!submitted && initialScore !== null && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
            Intento previo: {initialScore}%
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Responde y recibe retroalimentación personalizada de tu tutor.
      </p>

      <ol className="flex flex-col gap-5">
        {questions.map((q, qi) => {
          const selected = answers[qi];
          const questionResult = result?.perQuestion[qi];
          return (
            <li key={q.id}>
              <p className="mb-2 text-sm font-medium text-slate-900">
                {qi + 1}. {q.prompt}
              </p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const isSelected = selected === oi;
                  const isCorrect = oi === q.correctIndex;

                  // Estilos: neutro antes de enviar; verde/rojo después.
                  let optionClass =
                    "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40";
                  if (submitted) {
                    if (isCorrect) {
                      optionClass = "border-emerald-400 bg-emerald-50";
                    } else if (isSelected) {
                      optionClass = "border-red-300 bg-red-50";
                    } else {
                      optionClass = "border-slate-200 bg-white opacity-70";
                    }
                  } else if (isSelected) {
                    optionClass = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200";
                  }

                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => selectOption(qi, oi)}
                      disabled={submitted || isLoading}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-default ${optionClass}`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
                          isSelected ? "border-emerald-600" : "border-slate-300"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                      </span>
                      <span className="text-slate-700">{opt}</span>
                      {submitted && isCorrect && (
                        <span className="ml-auto text-xs font-medium text-emerald-700">✓</span>
                      )}
                      {submitted && isSelected && !questionResult?.isCorrect && (
                        <span className="ml-auto text-xs font-medium text-red-600">✗</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explicación tras responder (autoevaluación). */}
              {submitted && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-700">Explicación: </span>
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Acción / Resultado */}
      {!submitted ? (
        <div className="mt-5">
          <button
            onClick={() => void submitQuiz()}
            disabled={!allAnswered || isLoading}
            className="w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Calificando…" : "Enviar respuestas"}
          </button>
          {!allAnswered && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Responde todas las preguntas para enviar.
            </p>
          )}
          {error && <p className="mt-2 text-center text-xs text-amber-700">{error}</p>}
        </div>
      ) : (
        <div className="mt-5">
          {/* Puntaje */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-emerald-800">
              Puntaje: {result.correctCount} de {result.total} · {result.score}%
            </p>
          </div>

          {/* Feedback del tutor */}
          <div className="mt-4 flex items-start gap-2">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-100 text-base">
              🎓
            </span>
            <div className="min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-2.5 text-sm text-slate-800">
              {feedback ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={feedbackMarkdown}>
                  {feedback}
                </ReactMarkdown>
              ) : isLoading ? (
                <span className="text-slate-400">El tutor está preparando tu retroalimentación…</span>
              ) : error ? (
                <span className="text-amber-700">{error}</span>
              ) : null}
            </div>
          </div>

          <button
            onClick={resetQuiz}
            className="mt-4 w-full rounded-xl border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Reintentar quiz
          </button>
        </div>
      )}
    </section>
  );
}
