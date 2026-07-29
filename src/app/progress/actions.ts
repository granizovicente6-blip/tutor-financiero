"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lessonExists } from "@/lib/curriculum";
import { logEvent } from "@/lib/analytics";
import type { LessonStatus } from "@/lib/types";

const VALID_STATUS: LessonStatus[] = ["not_started", "in_progress", "completed"];

/**
 * Server Action: crea o actualiza el progreso del usuario en una lección.
 *
 * Usa UPSERT sobre (user_id, lesson_id). La política RLS
 * "lesson_progress_*_own" garantiza que solo puede tocar su propio progreso.
 * Valida `lessonId` contra el currículum en código para no aceptar slugs
 * arbitrarios.
 */
export async function setLessonStatus(
  lessonId: string,
  status: LessonStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!lessonExists(lessonId)) {
    return { ok: false, error: "Lección desconocida." };
  }
  if (!VALID_STATUS.includes(status)) {
    return { ok: false, error: "Estado inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  const completedAt = status === "completed" ? new Date().toISOString() : null;

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      status,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (error) {
    console.error("[progress] No se pudo guardar el progreso:", error);
    return { ok: false, error: "No se pudo guardar el progreso." };
  }

  // Al completar una lección, registra un "día activo" para la racha (atómico
  // en la BD) y un evento de analítica. No es crítico: si falla, el progreso ya
  // quedó guardado.
  if (status === "completed") {
    const { error: streakError } = await supabase.rpc("touch_streak");
    if (streakError) {
      console.error("[progress] No se pudo actualizar la racha:", streakError);
    }
    await logEvent(supabase, user.id, "lesson_completed", { lesson_id: lessonId });
  }

  // Refresca las vistas que muestran progreso.
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${lessonId}`);
  return { ok: true };
}
