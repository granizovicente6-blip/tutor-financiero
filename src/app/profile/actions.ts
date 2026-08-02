"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/analytics";
import {
  getDepthOption,
  getDiagnosticQuestion,
  isDiagnosticDepth,
  levelForAccuracy,
  type DiagnosticDepth,
} from "@/lib/diagnostic";
import { getPlacementForLevel } from "@/lib/placement";
import type { DiagnosticPlacement, DiagnosticResult, FinancialLevel } from "@/lib/types";

/** Cliente de Supabase ya autenticado (el que devuelve `createClient`). */
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
 * Server Action: corrige el Test de Diagnóstico y guarda el nivel resultante.
 *
 * El cliente manda QUÉ respondió (ids + índice elegido), nunca el puntaje: la
 * corrección se hace aquí contra el pool de `lib/diagnostic.ts`, que es la única
 * fuente de verdad de las respuestas correctas. Así nadie se asigna un nivel
 * avanzado desde la consola del navegador.
 *
 * La política RLS "profiles_update_own" garantiza además que solo se pueda
 * escribir el propio perfil.
 */
export async function saveDiagnosticResult(
  depth: DiagnosticDepth,
  answers: DiagnosticAnswer[],
): Promise<SaveDiagnosticState> {
  if (!isDiagnosticDepth(depth)) {
    return { ok: false, error: "Tipo de test inválido." };
  }

  const expected = getDepthOption(depth).questionCount;
  if (!Array.isArray(answers) || answers.length !== expected) {
    return { ok: false, error: "El test llegó incompleto. Inténtalo de nuevo." };
  }

  // Preguntas repetidas inflarían el porcentaje respondiendo una sola bien.
  const uniqueIds = new Set(answers.map((a) => a.questionId));
  if (uniqueIds.size !== answers.length) {
    return { ok: false, error: "Hay respuestas duplicadas. Inténtalo de nuevo." };
  }

  let correctCount = 0;
  const wrongQuestionIds: string[] = [];

  for (const answer of answers) {
    const question = getDiagnosticQuestion(answer.questionId);
    if (!question) {
      return { ok: false, error: "El test contiene preguntas desconocidas." };
    }
    if (answer.selectedIndex === question.correctIndex) {
      correctCount += 1;
    } else {
      wrongQuestionIds.push(question.id);
    }
  }

  const accuracy = Math.round((correctCount / expected) * 100);
  const level = levelForAccuracy(accuracy);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ financial_level: level })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] No se pudo guardar el nivel del diagnóstico:", error);
    return { ok: false, error: "No se pudo guardar tu nivel. Inténtalo de nuevo." };
  }

  // Convalidación: los módulos que el nivel da por superados quedan completados,
  // de modo que el candado secuencial abra el siguiente. Si falla, el nivel ya
  // está guardado y el estudiante puede avanzar a mano: no rompemos el flujo.
  const placement = await applyPlacement(supabase, user.id, level);

  await logEvent(supabase, user.id, "diagnostic_completed", {
    depth,
    accuracy,
    level,
    validated_now: placement.validatedNow,
  });

  // Las vistas con progreso son Server Components: sin esto seguirían mostrando
  // la ruta como estaba antes de convalidar.
  revalidatePath("/dashboard");
  revalidatePath("/");

  return {
    ok: true,
    result: { correctCount, total: expected, accuracy, level, wrongQuestionIds, placement },
  };
}

/**
 * Marca como completadas las lecciones que convalida el nivel obtenido.
 *
 * Nunca quita nada: solo escribe las lecciones que aún NO estaban completadas,
 * así repetir el test es siempre aditivo. Un intento peor no degrada el progreso
 * (las lecciones ya superadas siguen ahí) y uno mejor añade los módulos nuevos.
 *
 * Tampoco toca `quiz_score`: al no incluir la columna en el UPSERT, el valor que
 * hubiera de un intento real de quiz se conserva.
 */
async function applyPlacement(
  supabase: SupabaseServerClient,
  userId: string,
  level: FinancialLevel,
): Promise<DiagnosticPlacement> {
  const placement = getPlacementForLevel(level);
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
