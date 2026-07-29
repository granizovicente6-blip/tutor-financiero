"use server";

import { createClient } from "@/lib/supabase/server";
import type { FinancialLevel } from "@/lib/types";

const VALID_LEVELS: FinancialLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * Server Action: actualiza el nivel financiero del usuario autenticado.
 * La política RLS "profiles_update_own" garantiza que solo puede editar su
 * propio perfil.
 */
export async function updateFinancialLevel(
  level: FinancialLevel,
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_LEVELS.includes(level)) {
    return { ok: false, error: "Nivel inválido." };
  }

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
    console.error("[profile] No se pudo actualizar el nivel:", error);
    return { ok: false, error: "No se pudo actualizar el nivel." };
  }

  return { ok: true };
}
