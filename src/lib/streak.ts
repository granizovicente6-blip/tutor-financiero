// =============================================================================
// Racha de estudio — dominio compartido (Fase 5, expiración en migración 008)
//
// La racha se ESCRIBE con `touch_streak()` (al completar lección o quiz) y se
// LEE con `getStreak()`. La lectura no es un simple SELECT: una racha caduca
// sola cuando el usuario deja de estudiar, y nadie escribe en la BD ese día.
// Por eso toda lectura pasa por aquí, que valida la fecha antes de devolverla.
//
// Frontera del "día": 00:00 en Chile, la misma que usa `app_today()` en la BD
// (migración 008). Debe coincidir con la del SQL: si una parte contara en UTC,
// una lección completada de noche caería en días distintos según quién mire.
// =============================================================================

import type { createClient } from "@/lib/supabase/server";
import type { StreakInfo } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Racha vacía: ni empezada, ni perdida. Lo que ve un usuario nuevo. */
export const EMPTY_STREAK: StreakInfo = {
  current: 0,
  longest: 0,
  activeToday: false,
  lastActiveDate: null,
};

/**
 * Zona horaria del corte diario. La app es chilena: el día debe cambiar a las
 * 00:00 de Chile, no a las 00:00 UTC (que allí son las 20:00 o 21:00 del día
 * anterior). Réplica de la zona fijada en `app_today()` (migración 008).
 */
export const APP_TIME_ZONE = "America/Santiago";

/**
 * Fecha civil chilena de un instante, en formato `YYYY-MM-DD`.
 *
 * El locale `en-CA` es el truco: formatea justo como una columna `date` de
 * Postgres. La conversión de zona la hace Intl, que ya conoce el horario de
 * verano chileno, así que no hay desfases que compensar a mano.
 */
export function toDateOnly(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Días completos transcurridos entre `lastActiveDate` (YYYY-MM-DD) y hoy en
 * Chile. 0 = hoy, 1 = ayer, 2 = anteayer... `null` si no hay fecha o es ilegible.
 *
 * Ambas fechas son ya días civiles sin hora; se anclan a mediodía UTC solo para
 * restarlas. Al comparar días completos, los saltos de horario de verano (que
 * hacen que un día dure 23 o 25 horas) no afectan al resultado.
 */
export function daysSince(lastActiveDate: string | null, today: Date = new Date()): number | null {
  if (!lastActiveDate) return null;

  const last = Date.parse(`${lastActiveDate.slice(0, 10)}T12:00:00Z`);
  const now = Date.parse(`${toDateOnly(today)}T12:00:00Z`);
  if (Number.isNaN(last) || Number.isNaN(now)) return null;

  return Math.round((now - last) / 86_400_000);
}

/** Fila de `profiles` con las columnas de racha, tal cual llega de Supabase. */
interface StreakRow {
  current_streak?: number | null;
  longest_streak?: number | null;
  last_active_date?: string | null;
}

/**
 * Aplica la regla de expiración a una fila cruda de `profiles`.
 *
 *   - última actividad HOY       -> racha viva y ya cumplida hoy
 *   - última actividad AYER      -> racha viva, pendiente de la de hoy
 *   - anteayer o antes (o nunca) -> racha rota: current = 0
 *
 * `longest` no se toca nunca: es el récord histórico.
 *
 * Es una función pura, así que la UI muestra el valor correcto aunque la BD
 * todavía guarde el número viejo (ver `getStreak`).
 */
export function resolveStreak(row: StreakRow | null, today: Date = new Date()): StreakInfo {
  if (!row) return EMPTY_STREAK;

  const longest = row.longest_streak ?? 0;
  const lastActiveDate = row.last_active_date ?? null;
  const elapsed = daysSince(lastActiveDate, today);

  // Sin fecha o con más de un día de hueco, la racha se perdió.
  if (elapsed === null || elapsed > 1) {
    return { current: 0, longest, activeToday: false, lastActiveDate };
  }

  return {
    current: row.current_streak ?? 0,
    longest,
    // elapsed < 0 (fecha futura por desfase de reloj) cuenta como hoy: es mejor
    // que apagar por error una racha que sí está viva.
    activeToday: elapsed <= 0,
    lastActiveDate,
  };
}

/**
 * Lee la racha ya validada del usuario y persiste el reinicio si expiró.
 *
 * Vía la RPC `get_streak()` (migración 008), que hace comprobación y reinicio en
 * una sola operación atómica y con la fecha del servidor. Si la RPC todavía no
 * está aplicada, cae a leer las columnas y validarlas en código: la racha se
 * muestra bien igualmente, solo que la BD conserva el número viejo hasta el
 * próximo `touch_streak()`, que ya sabe reiniciarla.
 *
 * FAIL-SOFT: ante cualquier error devuelve la racha vacía. Un fallo de lectura
 * no debe tumbar la página; como mucho, la racha aparece apagada un rato.
 */
export async function getStreak(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StreakInfo> {
  const { data, error } = await supabase.rpc("get_streak");

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as
      | (StreakRow & { active_today?: boolean | null })
      | null
      | undefined;
    if (!row) return EMPTY_STREAK;

    return {
      current: row.current_streak ?? 0,
      longest: row.longest_streak ?? 0,
      activeToday: row.active_today ?? false,
      lastActiveDate: row.last_active_date ?? null,
    };
  }

  console.error("[streak] get_streak() no disponible, se valida en la app:", error);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_active_date")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[streak] No se pudo leer la racha:", profileError);
    return EMPTY_STREAK;
  }

  return resolveStreak(profile as StreakRow | null);
}
