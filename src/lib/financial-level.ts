// =============================================================================
// Lectura y escritura del nivel financiero del estudiante (`profiles`).
//
// Desde que el Test de Diagnóstico se separó por categorías hay TRES niveles:
//
//   · `financial_level`            — nivel global; es el que lee el tutor para
//                                    decidir cómo explicar. Se calcula con
//                                    `combineLevels` a partir de los otros dos.
//   · `financial_level_personal`   — nivel en Finanzas Personales.
//   · `financial_level_investing`  — nivel en Inversiones.
//
// Las dos columnas por categoría las añade la migración 009. Este módulo está
// escrito para TOLERAR que aún no se haya aplicado: si Postgres responde que la
// columna no existe, se reintenta con `financial_level` a secas y la app sigue
// funcionando exactamente como antes (con un nivel global). Así desplegar el
// código y correr la migración no tienen que ocurrir en el mismo instante.
// =============================================================================

import type { createClient } from "@/lib/supabase/server";
import type { DiagnosticCategory } from "@/lib/diagnostic";
import type { FinancialLevel } from "@/lib/types";

/** Cliente de Supabase ya autenticado (el que devuelve `createClient`). */
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Columna de `profiles` donde vive el nivel de cada categoría. */
const LEVEL_COLUMN: Record<DiagnosticCategory, string> = {
  "Finanzas Personales": "financial_level_personal",
  Inversiones: "financial_level_investing",
};

/** Niveles del estudiante: el global y el de cada categoría (null = sin medir). */
export interface FinancialLevels {
  overall: FinancialLevel | null;
  byCategory: Record<DiagnosticCategory, FinancialLevel | null>;
}

const EMPTY_LEVELS: FinancialLevels = {
  overall: null,
  byCategory: { "Finanzas Personales": null, Inversiones: null },
};

/**
 * True si el error de Postgres/PostgREST es "esa columna no existe", que es lo
 * que devuelve una base donde todavía no se aplicó la migración 009.
 *
 * - `42703` es el SQLSTATE `undefined_column` que llega desde Postgres.
 * - `PGRST204` es el equivalente de PostgREST cuando la columna no está en su
 *   caché de esquema (típico justo después de aplicar la migración).
 */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function asLevel(value: unknown): FinancialLevel | null {
  return value === "beginner" || value === "intermediate" || value === "advanced"
    ? value
    : null;
}

/**
 * Lee los tres niveles del perfil. Nunca lanza: si algo falla devuelve niveles
 * vacíos, que la UI trata igual que "aún no hizo el test".
 */
export async function readFinancialLevels(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<FinancialLevels> {
  const { data, error } = await supabase
    .from("profiles")
    .select("financial_level, financial_level_personal, financial_level_investing")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) {
    const row = data as Record<string, unknown>;
    return {
      overall: asLevel(row.financial_level),
      byCategory: {
        "Finanzas Personales": asLevel(row.financial_level_personal),
        Inversiones: asLevel(row.financial_level_investing),
      },
    };
  }

  if (error && !isMissingColumn(error)) {
    console.error("[financial-level] No se pudo leer el perfil:", error);
    return EMPTY_LEVELS;
  }

  if (!error) return EMPTY_LEVELS; // Perfil inexistente: nada que leer.

  // Migración 009 aún no aplicada: seguimos con el nivel global de siempre.
  const { data: legacy } = await supabase
    .from("profiles")
    .select("financial_level")
    .eq("id", userId)
    .maybeSingle();

  return {
    ...EMPTY_LEVELS,
    overall: asLevel((legacy as Record<string, unknown> | null)?.financial_level),
  };
}

/**
 * Guarda el nivel global y los de las categorías que se acaban de evaluar. Las
 * categorías que no vienen en `byCategory` se dejan intactas: rendir solo el
 * test de Inversiones no puede borrar el nivel de Finanzas Personales.
 *
 * Devuelve `false` solo si falló la escritura del nivel global, que es la que
 * de verdad importa (el tutor la lee en cada mensaje).
 */
export async function writeFinancialLevels(
  supabase: SupabaseServerClient,
  userId: string,
  overall: FinancialLevel,
  byCategory: Partial<Record<DiagnosticCategory, FinancialLevel>>,
): Promise<boolean> {
  const update: Record<string, string> = { financial_level: overall };
  for (const [category, level] of Object.entries(byCategory)) {
    if (level) update[LEVEL_COLUMN[category as DiagnosticCategory]] = level;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (!error) return true;

  if (!isMissingColumn(error)) {
    console.error("[financial-level] No se pudo guardar el nivel:", error);
    return false;
  }

  // Migración 009 aún no aplicada: guardamos al menos el nivel global, que es
  // lo que la app usaba antes de separar el diagnóstico por categorías.
  console.warn(
    "[financial-level] Faltan las columnas por categoría (migración 009). Se guarda solo financial_level.",
  );
  const { error: fallbackError } = await supabase
    .from("profiles")
    .update({ financial_level: overall })
    .eq("id", userId);

  if (fallbackError) {
    console.error("[financial-level] No se pudo guardar el nivel:", fallbackError);
    return false;
  }
  return true;
}
