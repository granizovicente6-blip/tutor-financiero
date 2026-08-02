"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getDepthOption,
  getDiagnosticQuestion,
  isDiagnosticDepth,
  levelForAccuracy,
  type DiagnosticDepth,
} from "@/lib/diagnostic";
import type { DiagnosticResult } from "@/lib/types";

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

  return {
    ok: true,
    result: { correctCount, total: expected, accuracy, level, wrongQuestionIds },
  };
}
