"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDiagnosticResult, type DiagnosticAnswer } from "@/app/profile/actions";
import {
  CATEGORY_META,
  DEFAULT_DIAGNOSTIC_DEPTH,
  DEFAULT_DIAGNOSTIC_SCOPE,
  DIAGNOSTIC_DEPTHS,
  DIAGNOSTIC_SCOPE_OPTIONS,
  categoriesForScope,
  getDepthOption,
  getDiagnosticQuestion,
  LEVEL_LABELS,
  LEVEL_SUMMARY,
  selectDiagnosticTest,
  SKIPPED_ANSWER,
  totalQuestionsFor,
  TOPIC_LABELS,
  type DiagnosticCategory,
  type DiagnosticDepth,
  type DiagnosticQuestion,
  type DiagnosticScope,
} from "@/lib/diagnostic";
import type {
  DiagnosticCategoryResult,
  DiagnosticPlacement,
  DiagnosticResult,
  FinancialLevel,
} from "@/lib/types";

/** Fases de la pantalla: elegir categoría y profundidad → responder → resultado. */
type Phase = "intro" | "quiz" | "result";

/** Una pregunta del intento, ya etiquetada con la categoría a la que puntúa. */
interface TestQuestion {
  category: DiagnosticCategory;
  question: DiagnosticQuestion;
}

export interface CurrentLevels {
  /** Nivel global guardado, o null si nunca hizo ningún test. */
  overall: FinancialLevel | null;
  /** Nivel por categoría; null en las que aún no se ha evaluado. */
  byCategory: Record<DiagnosticCategory, FinancialLevel | null>;
}

interface DiagnosticTestProps {
  currentLevels: CurrentLevels;
}

/**
 * Enlace a la ruta de aprendizaje apuntando a la categoría evaluada y, si lo
 * hay, al módulo exacto por el que continúa. Terminar el test de Inversiones
 * debe abrir el dashboard EN Inversiones, no en la pestaña por defecto.
 */
function routeHref(category: DiagnosticCategory, nextModuleSlug: string | null): string {
  // Se codifica a mano en vez de con `URLSearchParams` porque este último
  // escribe los espacios como `+` ("Finanzas+Personales"), y no todos los
  // parseadores de query los devuelven como espacio. `%20` no tiene ese matiz.
  const params = [`categoria=${encodeURIComponent(category)}`];
  if (nextModuleSlug) params.push(`modulo=${encodeURIComponent(nextModuleSlug)}`);
  return `/dashboard?${params.join("&")}`;
}

export function DiagnosticTest({ currentLevels }: DiagnosticTestProps): ReactNode {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [scope, setScope] = useState<DiagnosticScope>(DEFAULT_DIAGNOSTIC_SCOPE);
  const [depth, setDepth] = useState<DiagnosticDepth>(DEFAULT_DIAGNOSTIC_DEPTH);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  function startTest(): void {
    // Las preguntas se sortean aquí (en el navegador, al pulsar): cada intento
    // sale distinto sin que la página tenga que regenerarse en el servidor. Con
    // "Ambas" se responden los dos bloques seguidos, primero uno y luego el otro.
    const selected = selectDiagnosticTest(depth, scope).flatMap((block) =>
      block.questions.map((question) => ({ category: block.category, question })),
    );
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
    // Una pregunta que nunca se tocó viaja como omitida, igual que si el
    // estudiante hubiera pulsado "No lo sé": en ambos casos no hay certeza que
    // acreditar, y el servidor las cuenta como cero.
    const payload: DiagnosticAnswer[] = questions.map((q, i) => ({
      questionId: q.question.id,
      selectedIndex: answers[i] ?? SKIPPED_ANSWER,
    }));

    setIsSaving(true);
    setError(null);
    const state = await saveDiagnosticResult(scope, depth, payload);
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
        currentLevels={currentLevels}
        scope={scope}
        depth={depth}
        onSelectScope={setScope}
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
// 1. Selección de categoría y profundidad
// ---------------------------------------------------------------------------

interface IntroScreenProps {
  currentLevels: CurrentLevels;
  scope: DiagnosticScope;
  depth: DiagnosticDepth;
  onSelectScope: (scope: DiagnosticScope) => void;
  onSelectDepth: (depth: DiagnosticDepth) => void;
  onStart: () => void;
}

function IntroScreen({
  currentLevels,
  scope,
  depth,
  onSelectScope,
  onSelectDepth,
  onStart,
}: IntroScreenProps): ReactNode {
  const measured = (Object.keys(currentLevels.byCategory) as DiagnosticCategory[]).filter(
    (category) => currentLevels.byCategory[category] !== null,
  );
  const hasHistory = currentLevels.overall !== null || measured.length > 0;
  const total = totalQuestionsFor(depth, scope);
  const perCategory = getDepthOption(depth).questionCount;
  const categoryCount = categoriesForScope(scope).length;

  return (
    <section>
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
          🧭
        </span>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          {hasHistory ? "Vuelve a medir tu nivel" : "Empecemos por conocer tu punto de partida"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Hay un test para cada categoría del programa. Elige cuál quieres rendir: cada uno te
          asigna su propio nivel y convalida los módulos de esa categoría que ya dominas. No hay
          respuestas que «cuenten en tu contra»: mientras mejor te midamos, mejor te explicamos.
          Si una pregunta no la sabes, puedes omitirla; adivinar solo consigue que te saltes
          lecciones que te habrían servido.
        </p>

        {/* Niveles ya medidos, para saber qué conviene rendir ahora. */}
        {hasHistory && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {measured.length > 0 ? (
              measured.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  <span aria-hidden="true">{CATEGORY_META[category].emoji}</span>
                  {category}: {LEVEL_LABELS[currentLevels.byCategory[category]!]}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Nivel actual: {LEVEL_LABELS[currentLevels.overall!]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Paso 1 — categoría */}
      <fieldset className="mt-7">
        <legend className="mb-2 text-sm font-semibold text-slate-800">
          1. ¿Qué quieres evaluar?
        </legend>
        <div
          role="radiogroup"
          aria-label="Categoría del test de diagnóstico"
          className="grid gap-3 sm:grid-cols-3"
        >
          {DIAGNOSTIC_SCOPE_OPTIONS.map((option) => {
            const isSelected = option.key === scope;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectScope(option.key)}
                className={`flex flex-col rounded-2xl border-2 p-4 text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="mt-1.5 text-base font-bold text-slate-900">{option.label}</span>
                <span className="mt-1.5 text-xs leading-snug text-slate-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Paso 2 — profundidad */}
      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-semibold text-slate-800">
          2. ¿Con cuánta profundidad?
          {categoryCount > 1 && (
            <span className="ml-1 font-normal text-slate-500">(por cada categoría)</span>
          )}
        </legend>
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
                  {categoryCount > 1 ? " por categoría" : ""}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    ~{option.estimatedMinutes * categoryCount} min
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
        Comenzar test · {total} preguntas
        {categoryCount > 1 ? ` (${perCategory} de cada categoría)` : ""}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">
        Puedes repetir cualquiera de los tests cuando quieras; en cada categoría manda el
        resultado más reciente.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Test paso a paso
// ---------------------------------------------------------------------------

interface QuizScreenProps {
  questions: TestQuestion[];
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
  const { category, question } = questions[index];
  const selected = answers[index];
  const isSkipped = selected === SKIPPED_ANSWER;
  const isLast = index === total - 1;
  // La barra mide lo resuelto (respondido u omitido a propósito), no la pregunta
  // en pantalla: volver atrás a revisar no debería parecer que se pierde
  // progreso, y omitir es avanzar tanto como responder.
  const resolvedCount = answers.filter((a) => a !== null).length;
  const percent = Math.round((resolvedCount / total) * 100);

  // Posición dentro del bloque de su categoría: con "Ambas" el estudiante
  // necesita saber que cambió de test, no solo que avanzó una pregunta.
  const blockQuestions = questions.filter((q) => q.category === category);
  const blockIndex = questions.slice(0, index).filter((q) => q.category === category).length;
  const isMultiCategory = blockQuestions.length !== total;
  const startsBlock = isMultiCategory && blockIndex === 0;
  const meta = CATEGORY_META[category];

  return (
    <section>
      {/* Progreso */}
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>
          Pregunta {index + 1} de {total}
        </span>
        <span>{percent}% completado</span>
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

      {/* Aviso de cambio de bloque al entrar en la primera pregunta de una
          categoría (solo cuando se rinden las dos). */}
      {startsBlock && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-xs font-medium text-emerald-800">
          <span aria-hidden="true">{meta.emoji}</span> Empieza el test de {category} ·{" "}
          {blockQuestions.length} preguntas
        </p>
      )}

      {/* Pregunta */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            <span aria-hidden="true">{meta.emoji}</span> {category}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {TOPIC_LABELS[question.topic]}
          </span>
          {isMultiCategory && (
            <span className="text-[11px] font-medium text-slate-400">
              {blockIndex + 1}/{blockQuestions.length} de esta categoría
            </span>
          )}
        </div>
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

          {/* "No lo sé" es una alternativa más, no un atajo escondido: adivinar
              con 4 opciones acierta ~25% de las veces y ese ruido terminaría
              convalidando lecciones que no se dominan. Puntúa cero, igual que
              un error, así que declarar la duda nunca perjudica frente a fallar. */}
          <button
            type="button"
            role="radio"
            aria-checked={isSkipped}
            disabled={isSaving}
            onClick={() => onSelect(SKIPPED_ANSWER)}
            className={`mt-1 flex items-start gap-3 rounded-xl border border-dashed px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isSkipped
                ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
                : "border-slate-300 bg-slate-50 hover:border-amber-300 hover:bg-amber-50/40"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px] font-semibold ${
                isSkipped
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-slate-300 text-slate-500"
              }`}
              aria-hidden="true"
            >
              ➖
            </span>
            <span className="leading-relaxed">
              <span className="font-medium text-slate-700">No lo sé / Omitir</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Preferimos un «no lo sé» honesto a un acierto de suerte. Cuenta como no
                acertada, así que tu ruta parte donde de verdad corresponde.
              </span>
            </span>
          </button>
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
          Elige una alternativa —o «No lo sé»— para continuar.
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

/** Una pregunta del repaso, con el motivo por el que llegó ahí. */
interface ReviewItem {
  question: DiagnosticQuestion;
  outcome: "wrong" | "skipped";
}

/** Resuelve ids contra el pool, descartando los que no existan. */
function toReviewItems(ids: string[], outcome: ReviewItem["outcome"]): ReviewItem[] {
  return ids
    .map((id) => getDiagnosticQuestion(id))
    .filter((question): question is DiagnosticQuestion => question !== null)
    .map((question) => ({ question, outcome }));
}

/**
 * Qué se convalidó en una categoría. Tres mensajes distintos porque son tres
 * situaciones distintas: acabas de saltarte módulos, ya te los habías saltado
 * (repetiste el test sin subir de nivel) o empiezas desde el principio.
 */
function PlacementBanner({
  placement,
  category,
}: {
  placement: DiagnosticPlacement;
  category: DiagnosticCategory;
}): ReactNode {
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
            ? `Tu ruta de ${category} parte en «${nextModuleTitle}», el primer módulo de la categoría. Nada que saltarse: los cimientos son los que sostienen todo lo demás.`
            : `Tu ruta de ${category} parte desde el primer módulo.`}
        </p>
      </div>
    );
  }

  const isNew = validatedNow > 0;
  return (
    <div className="mx-auto mt-5 max-w-md rounded-xl border border-emerald-300 bg-white px-4 py-3 text-left">
      <p className="text-sm font-semibold text-emerald-800">
        {isNew
          ? `🎉 Te saltas ${validatedNow} ${lessonWord(validatedNow)} de ${category}`
          : `✅ Ya tenías ${validatedTotal} ${lessonWord(validatedTotal)} convalidadas en ${category}`}
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

/** Una cifra del desglose (correctas / incorrectas / omitidas). */
function ScoreTile({
  emoji,
  label,
  value,
  tone,
}: {
  emoji: string;
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber";
}): ReactNode {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  return (
    <div className={`rounded-xl border px-2 py-2.5 ${tones[tone]}`}>
      <p className="text-lg font-bold leading-tight">
        <span aria-hidden="true">{emoji}</span> {value}
      </p>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}

/**
 * Desglose de UNA categoría: nivel obtenido, cifras del intento, qué se
 * convalidó y el enlace directo a esa parte de la ruta.
 */
function CategoryResultCard({
  result,
  isOnly,
}: {
  result: DiagnosticCategoryResult;
  isOnly: boolean;
}): ReactNode {
  const summary = LEVEL_SUMMARY[result.category][result.level];
  const meta = CATEGORY_META[result.category];

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
      <div className="px-6 py-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          <span aria-hidden="true">{meta.emoji}</span> {result.category}
        </p>
        <span className="mt-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
          {summary.emoji}
        </span>
        <p className="mt-3 text-sm font-medium text-slate-600">
          {isOnly ? "Tu nivel es" : "Tu nivel en esta categoría es"}
        </p>
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

        {/* Desglose: correctas, incorrectas y omitidas. Las tres suman el total,
            y las dos últimas puntúan igual (cero): se separan porque no dicen lo
            mismo sobre lo que el estudiante sabe. */}
        <div className="mx-auto mt-3 grid max-w-sm grid-cols-3 gap-2">
          <ScoreTile emoji="✓" label="Correctas" value={result.correctCount} tone="emerald" />
          <ScoreTile emoji="✗" label="Incorrectas" value={result.incorrectCount} tone="rose" />
          <ScoreTile emoji="➖" label="Omitidas" value={result.skippedCount} tone="amber" />
        </div>

        <div
          className="mx-auto mt-4 h-2.5 max-w-sm overflow-hidden rounded-full bg-emerald-100"
          role="progressbar"
          aria-valuenow={result.accuracy}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Precisión lograda en el test de ${result.category}`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${result.accuracy}%` }}
          />
        </div>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600">
          {summary.detail}
        </p>

        <PlacementBanner placement={result.placement} category={result.category} />

        <Link
          href={routeHref(result.category, result.placement.nextModuleSlug)}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:w-auto sm:px-8"
        >
          {isOnly ? "Ir a mi Ruta de Aprendizaje" : `Ir a mi ruta de ${result.category}`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function ResultScreen({ result, onRetry }: ResultScreenProps): ReactNode {
  const isOnly = result.categories.length === 1;
  // El repaso junta todo lo que no se acertó —errado u omitido— de todas las
  // categorías evaluadas: el diagnóstico también enseña, y una pregunta que se
  // omitió por no saberla es justamente la que más conviene repasar.
  const review: ReviewItem[] = result.categories.flatMap((category) => [
    ...toReviewItems(category.wrongQuestionIds, "wrong"),
    ...toReviewItems(category.skippedQuestionIds, "skipped"),
  ]);

  return (
    <section>
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Test completado
      </p>

      {/* Con las dos categorías, el nivel global es el que usa el tutor al
          conversar: conviene decirlo antes del desglose. */}
      {!isOnly && (
        <div className="mx-auto mt-2 max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-500">
            Nivel con el que te hablará el tutor
          </p>
          <p className="text-lg font-bold text-slate-900">{LEVEL_LABELS[result.level]}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Resume tus dos categorías. Abajo tienes el detalle de cada una.
          </p>
        </div>
      )}

      <div className={`flex flex-col gap-4 ${isOnly ? "mt-3" : "mt-4"}`}>
        {result.categories.map((category) => (
          <CategoryResultCard key={category.category} result={category} isOnly={isOnly} />
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-500">
        Tu nivel quedó guardado: el tutor ya adapta sus explicaciones.
      </p>

      {/* Conceptos a repasar: lo errado y lo omitido, con su explicación. */}
      {review.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">
            📌 Conceptos a repasar ({review.length})
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Lo que fallaste y lo que preferiste omitir. Aquí no hay puntaje en juego: es la
            parte del test que enseña.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {review.map(({ question, outcome }) => (
              <li key={question.id} className="rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      outcome === "skipped"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {outcome === "skipped" ? "➖ Omitida" : "✗ Incorrecta"}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {TOPIC_LABELS[question.topic]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-slate-800">{question.prompt}</p>
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
          Rendir otro test
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
