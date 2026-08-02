"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { setLessonStatus } from "@/app/progress/actions";
import { LessonAudioPlayer } from "@/components/LessonAudioPlayer";
import { Quiz } from "@/components/Quiz";
import type { QuizQuestion } from "@/lib/curriculum";
import type { LessonStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Render de Markdown afinado para lectura de artículo (más aire que el chat)
// ---------------------------------------------------------------------------
const lessonMarkdown: Components = {
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 text-xl font-bold text-slate-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-5 text-base font-semibold text-slate-900">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 leading-7 text-slate-700">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-6 border-t border-slate-200" />,
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-emerald-300 bg-emerald-50/60 py-2 pl-4 pr-3 italic text-slate-600">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800">
      {children}
    </code>
  ),
};

interface LessonNav {
  slug: string;
  title: string;
}

interface LessonViewProps {
  lessonSlug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  moduleTitle: string;
  pathTitle: string;
  content: string;
  initialStatus: LessonStatus;
  quiz: QuizQuestion[] | null;
  initialScore: number | null;
  prev: LessonNav | null;
  next: LessonNav | null;
  /** La siguiente lección aún está bloqueada (se abre al completar esta). */
  nextLocked?: boolean;
  /** True si la membresía está activa (abre el Modo Podcast completo). */
  isPremium: boolean;
  /** Precio ya formateado ("$4.990"): el formato lo decide el servidor. */
  priceLabel: string;
  /** Moneda del plan ("CLP"), tal como la publica `lib/subscription`. */
  currencyLabel: string;
}

export function LessonView({
  lessonSlug,
  title,
  summary,
  estimatedMinutes,
  moduleTitle,
  pathTitle,
  content,
  initialStatus,
  quiz,
  initialScore,
  prev,
  next,
  nextLocked = false,
  isPremium,
  priceLabel,
  currencyLabel,
}: LessonViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LessonStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const markedInProgress = useRef(false);

  // Al abrir una lección aún no iniciada, la marcamos "en progreso" una sola vez.
  useEffect(() => {
    if (initialStatus === "not_started" && !markedInProgress.current) {
      markedInProgress.current = true;
      void setLessonStatus(lessonSlug, "in_progress").then((res) => {
        if (res.ok) setStatus("in_progress");
      });
    }
  }, [initialStatus, lessonSlug]);

  function completeLesson(): void {
    if (status === "completed" || isPending) return;
    startTransition(async () => {
      const res = await setLessonStatus(lessonSlug, "completed");
      if (res.ok) {
        setStatus("completed");
        router.refresh(); // refresca el % del dashboard al volver
      }
    });
  }

  // Cuando la lección tiene quiz, aprobarlo la marca como completada.
  function handleQuizCompleted(): void {
    setStatus("completed");
    router.refresh();
  }

  const isCompleted = status === "completed";

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/dashboard"
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            ← Mi ruta
          </Link>
          {isCompleted && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              ✓ Completada
            </span>
          )}
        </div>
      </header>

      {/* El padding inferior deja sitio al mini-reproductor fijo del Modo Podcast. */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
        {/* Encabezado de la lección */}
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
          {pathTitle} · {moduleTitle}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary}</p>
        <p className="mt-2 text-xs text-slate-400">⏱ {estimatedMinutes} min de lectura</p>

        {/* Modo Podcast: la lección también se puede escuchar. */}
        <LessonAudioPlayer
          lessonSlug={lessonSlug}
          title={title}
          summary={summary}
          content={content}
          isPremium={isPremium}
          priceLabel={priceLabel}
          currencyLabel={currencyLabel}
        />

        <hr className="my-6 border-t border-slate-200" />

        {/* Contenido */}
        <article className="text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={lessonMarkdown}>
            {content}
          </ReactMarkdown>
        </article>

        {/* Acción de completado: quiz (si existe) o botón manual. */}
        {quiz && quiz.length > 0 ? (
          <Quiz
            lessonSlug={lessonSlug}
            questions={quiz}
            initialScore={initialScore}
            onCompleted={handleQuizCompleted}
          />
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            {isCompleted ? (
              <p className="text-sm font-medium text-emerald-700">
                🎉 ¡Lección completada! Ya cuenta en tu progreso.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  ¿Terminaste de leer? Marca la lección para registrar tu avance.
                </p>
                <button
                  onClick={completeLesson}
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Guardando…" : "Marcar como completada"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Sugerencia: llevar la duda al tutor */}
        <p className="mt-4 text-center text-xs text-slate-500">
          ¿Te surgió una duda?{" "}
          <Link href="/" className="font-medium text-emerald-700 hover:underline">
            Pregúntale al tutor
          </Link>
          .
        </p>

        {/* Navegación anterior / siguiente */}
        <nav className="mt-8 flex items-stretch justify-between gap-3">
          {prev ? (
            <Link
              href={`/dashboard/${prev.slug}`}
              className="group flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-300"
            >
              <span className="block text-[11px] text-slate-400">← Anterior</span>
              <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-emerald-700">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            // Completar esta lección es justo lo que desbloquea la siguiente, así
            // que en cuanto el estado local pasa a "completada" el enlace se abre
            // sin esperar al refresco del servidor.
            nextLocked && !isCompleted ? (
              <div
                aria-disabled="true"
                title="Completa esta lección para desbloquear la siguiente"
                className="flex-1 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right opacity-70"
              >
                <span className="block text-[11px] text-slate-400">🔒 Siguiente</span>
                <span className="block truncate text-sm font-medium text-slate-500">
                  Completa esta lección para desbloquearla
                </span>
              </div>
            ) : (
              <Link
                href={`/dashboard/${next.slug}`}
                className="group flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-emerald-300"
              >
                <span className="block text-[11px] text-slate-400">Siguiente →</span>
                <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-emerald-700">
                  {next.title}
                </span>
              </Link>
            )
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </main>
    </div>
  );
}
