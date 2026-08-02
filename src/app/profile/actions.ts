"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/analytics";
import {
  categoriesForScope,
  combineLevels,
  DIAGNOSTIC_CATEGORIES,
  getDepthOption,
  getDiagnosticQuestion,
  isDiagnosticDepth,
  isDiagnosticScope,
  levelForAccuracy,
  questionCategory,
  type DiagnosticCategory,
  type DiagnosticDepth,
  type DiagnosticScope,
} from "@/lib/diagnostic";
import {
  readFinancialLevels,
  writeFinancialLevels,
  type SupabaseServerClient,
} from "@/lib/financial-level";
import { getPlacementForCategory } from "@/lib/placement";
import type {
  DiagnosticCategoryResult,
  DiagnosticPlacement,
  DiagnosticResult,
  FinancialLevel,
} from "@/lib/types";

/** Una respuesta tal como la manda el cliente al terminar el test. */
export interface DiagnosticAnswer {
  questionId: string;
  selectedIndex: number;
}

export interface SaveDiagnosticState {
  ok: boolean;
  error?: string;
  result?: DiagnosticResult;
}

/**
 * Server Action: corrige el Test de Diagnóstico y guarda los niveles resultantes.
 *
 * El cliente manda QUÉ respondió (ids + índice elegido), nunca el puntaje ni la
 * categoría: la corrección se hace aquí contra el pool de `lib/diagnostic.ts`,
 * que es la única fuente de verdad tanto de las respuestas correctas como del
 * tema —y por tanto la categoría— de cada pregunta. Así nadie se asigna un nivel
 * avanzado desde la consola del navegador ni convalida módulos de Inversiones
 * respondiendo preguntas de presupuesto.
 *
 * La política RLS "profiles_update_own" garantiza además que solo se pueda
 * escribir el propio perfil.
 */
export async function saveDiagnosticResult(
  scope: DiagnosticScope,
  depth: DiagnosticDepth,
  answers: DiagnosticAnswer[],
): Promise<SaveDiagnosticState> {
  if (!isDiagnosticScope(scope)) {
    return { ok: false, error: "Categoría de test inválida." };
  }
  if (!isDiagnosticDepth(depth)) {
    return { ok: false, error: "Tipo de test inválido." };
  }

  const categories = categoriesForScope(scope);
  const perCategory = getDepthOption(depth).questionCount;
  if (!Array.isArray(answers) || answers.length !== perCategory * categories.length) {
    return { ok: false, error: "El test llegó incompleto. Inténtalo de nuevo." };
  }

  // Preguntas repetidas inflarían el porcentaje respondiendo una sola bien.
  const uniqueIds = new Set(answers.map((a) => a.questionId));
  if (uniqueIds.size !== answers.length) {
    return { ok: false, error: "Hay respuestas duplicadas. Inténtalo de nuevo." };
  }

  // Corrección: cada respuesta cae en el saco de la categoría de SU pregunta.
  const scored = new Map<DiagnosticCategory, { correct: number; wrong: string[] }>(
    categories.map((category) => [category, { correct: 0, wrong: [] }]),
  );

  for (const answer of answers) {
    const question = getDiagnosticQuestion(answer.questionId);
    if (!question) {
      return { ok: false, error: "El test contiene preguntas desconocidas." };
    }
    const bucket = scored.get(questionCategory(question));
    if (!bucket) {
      // Una pregunta fuera del alcance elegido: el intento no es corregible sin
      // decidir a qué nivel afecta, así que se rechaza entero.
      return { ok: false, error: "El test mezcla categorías. Inténtalo de nuevo." };
    }
    if (answer.selectedIndex === question.correctIndex) bucket.correct += 1;
    else bucket.wrong.push(question.id);
  }

  // Cada categoría debe traer exactamente las preguntas que se anunciaron: si no
  // cuadra, el porcentaje no sería comparable con los umbrales de nivel.
  for (const category of categories) {
    const bucket = scored.get(category)!;
    if (bucket.correct + bucket.wrong.length !== perCategory) {
      return { ok: false, error: "El test llegó incompleto. Inténtalo de nuevo." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  // Niveles por categoría: los recién medidos mandan; los que no se evaluaron se
  // conservan tal cual estaban (rendir Inversiones no puede tocar el nivel de
  // Finanzas Personales).
  const stored = await readFinancialLevels(supabase, user.id);
  const measured: Partial<Record<DiagnosticCategory, FinancialLevel>> = {};
  const categoryAccuracy = new Map<DiagnosticCategory, number>();

  for (const category of categories) {
    const bucket = scored.get(category)!;
    const accuracy = Math.round((bucket.correct / perCategory) * 100);
    categoryAccuracy.set(category, accuracy);
    measured[category] = levelForAccuracy(accuracy);
  }

  // Nivel global (el que lee el tutor): resume ambas competencias en una.
  const effective = DIAGNOSTIC_CATEGORIES.map(
    (category) => measured[category] ?? stored.byCategory[category],
  ).filter((level): level is FinancialLevel => level !== null);

  // Si de la otra categoría no sabemos nada —porque nunca se evaluó, o porque la
  // migración 009 aún no está aplicada— el nivel global anterior es el único
  // recuerdo que queda de ella: lo tomamos en cuenta para no degradar a alguien
  // que solo vino a medirse en una categoría.
  const overall = combineLevels(
    effective.length > 1 || !stored.overall ? effective : [...effective, stored.overall],
  );

  if (!(await writeFinancialLevels(supabase, user.id, overall, measured))) {
    return { ok: false, error: "No se pudo guardar tu nivel. Inténtalo de nuevo." };
  }

  // Convalidación: los módulos que cada nivel da por superados quedan completados
  // DENTRO DE SU CATEGORÍA, de modo que el candado secuencial abra el siguiente.
  // Si falla, el nivel ya está guardado y el estudiante puede avanzar a mano: no
  // rompemos el flujo.
  const results: DiagnosticCategoryResult[] = [];
  for (const category of categories) {
    const bucket = scored.get(category)!;
    const level = measured[category]!;
    results.push({
      category,
      correctCount: bucket.correct,
      total: perCategory,
      accuracy: categoryAccuracy.get(category)!,
      level,
      wrongQuestionIds: bucket.wrong,
      placement: await applyPlacement(supabase, user.id, category, level),
    });
  }

  const correctCount = results.reduce((sum, r) => sum + r.correctCount, 0);
  const total = perCategory * categories.length;

  await logEvent(supabase, user.id, "diagnostic_completed", {
    scope,
    depth,
    level: overall,
    accuracy: Math.round((correctCount / total) * 100),
    categories: results.map((r) => ({
      category: r.category,
      accuracy: r.accuracy,
      level: r.level,
      validated_now: r.placement.validatedNow,
    })),
  });

  // Las vistas con progreso son Server Components: sin esto seguirían mostrando
  // la ruta como estaba antes de convalidar.
  revalidatePath("/dashboard");
  revalidatePath("/");

  return {
    ok: true,
    result: {
      scope,
      level: overall,
      correctCount,
      total,
      accuracy: Math.round((correctCount / total) * 100),
      categories: results,
    },
  };
}

/**
 * Marca como completadas las lecciones que convalida el nivel obtenido EN UNA
 * CATEGORÍA.
 *
 * Nunca quita nada: solo escribe las lecciones que aún NO estaban completadas,
 * así repetir el test es siempre aditivo. Un intento peor no degrada el progreso
 * (las lecciones ya superadas siguen ahí) y uno mejor añade los módulos nuevos.
 * Y como los slugs salen de `getPlacementForCategory`, un test de Inversiones no
 * puede escribir progreso de Finanzas Personales.
 *
 * Tampoco toca `quiz_score`: al no incluir la columna en el UPSERT, el valor que
 * hubiera de un intento real de quiz se conserva.
 */
async function applyPlacement(
  supabase: SupabaseServerClient,
  userId: string,
  category: DiagnosticCategory,
  level: FinancialLevel,
): Promise<DiagnosticPlacement> {
  const placement = getPlacementForCategory(category, level);
  const base: DiagnosticPlacement = {
    validatedNow: 0,
    validatedTotal: placement.lessonSlugs.length,
    moduleTitles: placement.modules.map((m) => m.title),
    nextModuleSlug: placement.nextModule?.slug ?? null,
    nextModuleTitle: placement.nextModule?.title ?? null,
  };

  if (placement.lessonSlugs.length === 0) {
    return base; // Principiante: empieza por el principio, no hay nada que convalidar.
  }

  const { data: existing, error: readError } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .in("lesson_id", placement.lessonSlugs);

  if (readError) {
    console.error("[profile] No se pudo leer el progreso previo:", readError);
    return base;
  }

  const alreadyCompleted = new Set(
    (existing ?? [])
      .filter((row) => row.status === "completed")
      .map((row) => row.lesson_id as string),
  );
  const pending = placement.lessonSlugs.filter((slug) => !alreadyCompleted.has(slug));
  if (pending.length === 0) {
    return base; // Repitió el test sin subir de nivel: ya estaba todo convalidado.
  }

  const now = new Date().toISOString();
  const { error: writeError } = await supabase.from("lesson_progress").upsert(
    pending.map((slug) => ({
      user_id: userId,
      lesson_id: slug,
      status: "completed",
      completed_at: now,
      updated_at: now,
    })),
    { onConflict: "user_id,lesson_id" },
  );

  if (writeError) {
    console.error("[profile] No se pudieron convalidar las lecciones:", writeError);
    return base;
  }

  // A diferencia de completar una lección estudiándola, esto NO toca la racha:
  // convalidar no es un día de estudio.
  return { ...base, validatedNow: pending.length };
}
