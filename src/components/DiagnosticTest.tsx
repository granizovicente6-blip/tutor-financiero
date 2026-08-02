"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDiagnosticResult, type DiagnosticAnswer } from "@/app/profile/actions";
import {
  DEFAULT_DIAGNOSTIC_DEPTH,
  DIAGNOSTIC_DEPTHS,
  getDepthOption,
  getDiagnosticQuestion,
  LEVEL_LABELS,
  LEVEL_SUMMARY,
  selectDiagnosticQuestions,
  TOPIC_LABELS,
  type DiagnosticDepth,
  type DiagnosticQuestion,
} from "@/lib/diagnostic";
import type { DiagnosticPlacement, DiagnosticResult, FinancialLevel } from "@/lib/types";

/** Fases de la pantalla: elegir profundidad → responder → resultado. */
type Phase = "intro" | "quiz" | "result";

interface DiagnosticTestProps {
  /** Nivel actual del perfil, o null si nunca hizo el test. */
  currentLevel: FinancialLevel | null;
}

export function DiagnosticTest({ currentLevel }: DiagnosticTestProps): ReactNode {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [depth, setDepth] = useState<DiagnosticDepth>(DEFAULT_DIAGNOSTIC_DEPTH);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  function startTest(): void {
    // Las preguntas se sortean aquí (en el navegador, al pulsar): cada intento
    // sale distinto sin que la página tenga que regenerarse en el servidor.
    const selected = selectDiagnosticQuestions(depth);
    setQuestions(selected);
    setAnswers(selected.map(() => null));
    setIndex(0);
    setError(null);
    setResult(null);
    setPhase("quiz");
  }

  function backToIntro(): void {
    setPhase("intro");
    setQuestions([]);
    setAnswers([]);
    setIndex(0);
    setError(null);
    setResult(null);
  }

  function selectOption(optionIndex: number): void {
    if (isSaving) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
  }

  async function finish(): Promise<void> {
    if (isSaving) return;
    const payload: DiagnosticAnswer[] = questions.map((q, i) => ({
      questionId: q.id,
      selectedIndex: answers[i] ?? -1, // -1 nunca coincide con correctIndex
    }));

    setIsSaving(true);
    setError(null);
    const state = await saveDiagnosticResult(depth, payload);
    setIsSaving(false);

    if (!state.ok || !state.result) {
      setError(state.error ?? "No se pudo guardar tu resultado. Inténtalo de nuevo.");
      return;
    }

    setResult(state.result);
    setPhase("result");
    // El nivel vive en Server Components (cabecera del chat, ruta de
    // aprendizaje): sin refresh seguirían mostrando el valor anterior.
    router.refresh();
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        currentLevel={currentLevel}
        depth={depth}
        onSelectDepth={setDepth}
        onStart={startTest}
      />
    );
  }

  if (phase === "result" && result) {
    return <ResultScreen result={result} onRetry={backToIntro} />;
  }

  return (
    <QuizScreen
      questions={questions}
      answers={answers}
      index={index}
      isSaving={isSaving}
      error={error}
      onSelect={selectOption}
      onPrev={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
      onFinish={() => void finish()}
      onCancel={backToIntro}
    />
  );
}

// ---------------------------------------------------------------------------
// 1. Selección de la profundidad del test
// ---------------------------------------------------------------------------

interface IntroScreenProps {
  currentLevel: FinancialLevel | null;
  depth: DiagnosticDepth;
  onSelectDepth: (depth: DiagnosticDepth) => void;
  onStart: () => void;
}

function IntroScreen({
  currentLevel,
  depth,
  onSelectDepth,
  onStart,
}: IntroScreenProps): ReactNode {
  return (
    <section>
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
          🧭
        </span>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          {currentLevel ? "Vuelve a medir tu nivel" : "Empecemos por conocer tu punto de partida"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Responde unas preguntas sobre presupuesto, interés compuesto, inversiones en Chile
          (APV, ETFs) e impuestos básicos. Con eso ajustamos el nivel del tutor y tu ruta de
          aprendizaje. No hay respuestas que «cuenten en tu contra»: mientras mejor te midamos,
          mejor te explicamos.
        </p>
        {currentLevel && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Nivel actual: {LEVEL_LABELS[currentLevel]}
          </p>
        )}
      </div>

      <fieldset className="mt-7">
        <legend className="sr-only">Profundidad del test de diagnóstico</legend>
        <div
          role="radiogroup"
          aria-label="Profundidad del test de diagnóstico"
          className="grid gap-3 sm:grid-cols-3"
        >
          {DIAGNOSTIC_DEPTHS.map((option) => {
            const isSelected = option.key === depth;
            const isDefault = option.key === DEFAULT_DIAGNOSTIC_DEPTH;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectDepth(option.key)}
                className={`relative flex flex-col rounded-2xl border-2 p-4 text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                }`}
              >
                {isDefault && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Recomendado
                  </span>
                )}
                <span className="text-2xl" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="mt-1.5 text-base font-bold text-slate-900">{option.label}</span>
                <span className="mt-0.5 text-sm font-medium text-slate-700">
                  {option.questionCount} preguntas
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    ~{option.estimatedMinutes} min
                  </span>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                    {option.accuracy}% precisión
                  </span>
                </span>
                <span className="mt-2 text-xs leading-snug text-slate-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
      >
        Comenzar test · {getDepthOption(depth).questionCount} preguntas
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">
        Puedes repetir el test cuando quieras; siempre manda el resultado más reciente.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Test paso a paso
// ---------------------------------------------------------------------------

interface QuizScreenProps {
  questions: DiagnosticQuestion[];
  answers: (number | null)[];
  index: number;
  isSaving: boolean;
  error: string | null;
  onSelect: (optionIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

function QuizScreen({
  questions,
  answers,
  index,
  isSaving,
  error,
  onSelect,
  onPrev,
  onNext,
  onFinish,
  onCancel,
}: QuizScreenProps): ReactNode {
  const total = questions.length;
  const question = questions[index];
  const selected = answers[index];
  const isLast = index === total - 1;
  const answeredCount = answers.filter((a) => a !== null).length;
  // La barra mide lo respondido, no la pregunta en pantalla: volver atrás a
  // revisar no debería parecer que se pierde progreso.
  const percent = Math.round((answeredCount / total) * 100);

  return (
    <section>
      {/* Progreso */}
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>
          Pregunta {index + 1} de {total}
        </span>
        <span>{percent}% respondido</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del test de diagnóstico"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Pregunta */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          {TOPIC_LABELS[question.topic]}
        </span>
        <h2 className="mt-2 text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
          {question.prompt}
        </h2>

        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Alternativas">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            return (
              <button
                key={optionIndex}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isSaving}
                onClick={() => onSelect(optionIndex)}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px] font-semibold ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 text-slate-500"
                  }`}
                  aria-hidden="true"
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="leading-relaxed text-slate-700">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          {error}
        </p>
      )}

      {/* Navegación */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={index === 0 ? onCancel : onPrev}
          disabled={isSaving}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {index === 0 ? "Salir" : "← Anterior"}
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={selected === null || isSaving}
            className="flex-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Calculando tu nivel…" : "Ver mi resultado"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={selected === null || isSaving}
            className="flex-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente →
          </button>
        )}
      </div>
      {selected === null && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Elige una alternativa para continuar.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Resultado
// ---------------------------------------------------------------------------

interface ResultScreenProps {
  result: DiagnosticResult;
  onRetry: () => void;
}

/**
 * Qué se convalidó con este resultado. Tres mensajes distintos porque son tres
 * situaciones distintas: acabas de saltarte módulos, ya te los habías saltado
 * (repetiste el test sin subir de nivel) o empiezas desde el principio.
 */
function PlacementBanner({ placement }: { placement: DiagnosticPlacement }): ReactNode {
  const { validatedNow, validatedTotal, moduleTitles, nextModuleTitle } = placement;
  const modules = moduleTitles.map((title) => `«${title}»`).join(", ");
  const lessonWord = (n: number) => (n === 1 ? "lección" : "lecciones");
  const moduleWord = moduleTitles.length === 1 ? "el módulo" : "los módulos";

  // Principiante: nada que convalidar, pero sí conviene decirle por dónde parte.
  if (validatedTotal === 0) {
    return (
      <div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-left">
        <p className="text-sm font-semibold text-slate-800">🚩 Empiezas desde la base</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {nextModuleTitle
            ? `Tu ruta parte en «${nextModuleTitle}», el primer módulo del programa. Nada que saltarse: los cimientos son los que sostienen todo lo demás.`
            : "Tu ruta parte desde el primer módulo del programa."}
        </p>
      </div>
    );
  }

  const isNew = validatedNow > 0;
  return (
    <div className="mx-auto mt-5 max-w-md rounded-xl border border-emerald-300 bg-white px-4 py-3 text-left">
      <p className="text-sm font-semibold text-emerald-800">
        {isNew
          ? `🎉 Te saltas ${validatedNow} ${lessonWord(validatedNow)}`
          : `✅ Ya tenías ${validatedTotal} ${lessonWord(validatedTotal)} convalidadas`}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Por tu desempeño damos por superado {moduleWord} {modules}
        {isNew && validatedNow < validatedTotal
          ? ` (${validatedTotal} ${lessonWord(validatedTotal)} en total, algunas ya las llevabas completadas)`
          : ""}
        .{" "}
        {nextModuleTitle ? (
          <>
            Tu ruta continúa en <strong className="font-semibold text-slate-800">«{nextModuleTitle}»</strong>.
          </>
        ) : (
          "Tu ruta continúa en el siguiente módulo."
        )}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
        Quedaron marcadas como completadas en tu ruta, pero puedes abrirlas y repasarlas
        cuando quieras.
      </p>
    </div>
  );
}

function ResultScreen({ result, onRetry }: ResultScreenProps): ReactNode {
  const summary = LEVEL_SUMMARY[result.level];
  const missed = result.wrongQuestionIds
    .map((id) => getDiagnosticQuestion(id))
    .filter((q): q is DiagnosticQuestion => q !== null);

  // El CTA no manda al índice de la ruta, sino al módulo por el que le toca
  // seguir: es el punto exacto donde lo dejó la convalidación.
  const { placement } = result;
  const routeHref = placement.nextModuleSlug
    ? `/dashboard?modulo=${encodeURIComponent(placement.nextModuleSlug)}`
    : "/dashboard";

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
        <div className="px-6 py-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Test completado
          </p>
          <span className="mt-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
            {summary.emoji}
          </span>
          <p className="mt-3 text-sm font-medium text-slate-600">Tu nivel es</p>
          <h2 className="text-3xl font-bold text-emerald-800">{LEVEL_LABELS[result.level]}</h2>
          <p className="mt-1 text-sm font-medium text-slate-700">{summary.headline}</p>

          {/* Cifras del intento */}
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-2xl font-bold text-slate-900">{result.accuracy}%</p>
              <p className="text-[11px] font-medium text-slate-500">Precisión lograda</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-2xl font-bold text-slate-900">
                {result.correctCount}/{result.total}
              </p>
              <p className="text-[11px] font-medium text-slate-500">Respuestas correctas</p>
            </div>
          </div>

          <div
            className="mx-auto mt-4 h-2.5 max-w-sm overflow-hidden rounded-full bg-emerald-100"
            role="progressbar"
            aria-valuenow={result.accuracy}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Precisión lograda en el test"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${result.accuracy}%` }}
            />
          </div>

          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600">
            {summary.detail}
          </p>

          <PlacementBanner placement={placement} />

          <Link
            href={routeHref}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:w-auto sm:px-8"
          >
            Ir a mi Ruta de Aprendizaje <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-2 text-[11px] text-slate-500">
            Tu nivel quedó guardado: el tutor ya adapta sus explicaciones.
          </p>
        </div>
      </div>

      {/* Repaso de lo fallado: el diagnóstico también enseña. */}
      {missed.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">
            📌 Repasa lo que se te escapó ({missed.length})
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {missed.map((question) => (
              <li key={question.id} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-800">{question.prompt}</p>
                <p className="mt-1.5 text-xs font-medium text-emerald-800">
                  Respuesta correcta: {question.options[question.correctIndex]}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {question.explanation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Repetir el test
        </button>
        <Link
          href="/"
          className="flex-1 rounded-xl border border-slate-300 px-5 py-2.5 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Ir al chat con el tutor
        </Link>
      </div>
    </section>
  );
}
