// =============================================================================
// Reglas de avance secuencial del currículum.
//
// La secuencia de referencia es la de cada CATEGORÍA (el mismo orden que muestra
// el dashboard), no la lista global: así "Finanzas Personales" e "Inversiones"
// se pueden empezar de forma independiente.
//
// Este archivo es la única fuente de la regla. Lo usan tanto el dashboard (para
// pintar los candados) como la página de la lección (para proteger la URL), de
// modo que ambos no puedan discrepar.
// =============================================================================

import { CATEGORIES, getLessonsByCategory, type Lesson } from "@/lib/curriculum";
import type { LessonProgress, LessonStatus } from "@/lib/types";

/** Filas de progreso reducidas a lo que necesitan estas reglas. */
export type ProgressRow = Pick<LessonProgress, "lesson_id" | "status">;

/** Mapa slug -> estado, para consultas O(1). */
export function buildStatusMap(progress: ProgressRow[]): Map<string, LessonStatus> {
  return new Map(progress.map((p) => [p.lesson_id, p.status]));
}

/**
 * Slugs de las lecciones a las que el estudiante puede entrar.
 *
 * Una lección está desbloqueada si:
 * 1. es la **primera** de su categoría, o
 * 2. ya tiene progreso propio (`in_progress` o `completed`) — nadie pierde el
 *    acceso a algo que ya había empezado, o
 * 3. la lección **inmediatamente anterior** de su categoría está completada.
 */
export function getUnlockedLessonSlugs(
  statusBySlug: Map<string, LessonStatus>,
): Set<string> {
  const unlocked = new Set<string>();

  for (const category of CATEGORIES) {
    // La primera de cada categoría siempre está abierta.
    let previousCompleted = true;

    for (const lesson of getLessonsByCategory(category)) {
      const status = statusBySlug.get(lesson.slug) ?? "not_started";
      if (previousCompleted || status !== "not_started") unlocked.add(lesson.slug);
      previousCompleted = status === "completed";
    }
  }

  return unlocked;
}

/** True si el estudiante puede abrir esa lección. Slug inexistente → false. */
export function isLessonUnlocked(
  slug: string,
  statusBySlug: Map<string, LessonStatus>,
): boolean {
  return getUnlockedLessonSlugs(statusBySlug).has(slug);
}

/**
 * Lección inmediatamente anterior dentro de la misma categoría, que es la que
 * hay que completar para desbloquear `slug`. Devuelve `null` para la primera de
 * la categoría o si el slug no existe.
 */
export function getPreviousLessonInCategory(slug: string): Lesson | null {
  for (const category of CATEGORIES) {
    const sequence = getLessonsByCategory(category);
    const index = sequence.findIndex((l) => l.slug === slug);
    if (index > 0) return sequence[index - 1];
    if (index === 0) return null;
  }
  return null;
}
