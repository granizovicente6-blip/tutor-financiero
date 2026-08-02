// =============================================================================
// Reglas de acceso al currículum: avance secuencial + muro de pago.
//
// Hay DOS candados distintos y no deben confundirse:
//
//  1. 🔒 SECUENCIAL — se abre estudiando. La secuencia de referencia es la de
//     cada CATEGORÍA (el mismo orden que muestra el dashboard), no la lista
//     global: así "Finanzas Personales" e "Inversiones" se pueden empezar de
//     forma independiente.
//
//  2. 👑 PREMIUM — se abre pagando. Sin suscripción activa solo se accede al
//     contenido de prueba (ver `getFreeLessonSlugs`); el resto exige membresía.
//
// El candado de suscripción manda sobre el secuencial: una lección de pago se
// muestra como Premium aunque el estudiante ya la hubiera empezado antes (p. ej.
// tras cancelar la suscripción).
//
// Este archivo es la única fuente de las dos reglas. Lo usan tanto el dashboard
// (para pintar los candados) como la página de la lección (para proteger la URL),
// de modo que ambos no puedan discrepar.
// =============================================================================

import {
  CATEGORIES,
  getLessonsByCategory,
  getModulesByCategory,
  type Category,
  type Lesson,
} from "@/lib/curriculum";
import type { LessonProgress, LessonStatus } from "@/lib/types";

/** Filas de progreso reducidas a lo que necesitan estas reglas. */
export type ProgressRow = Pick<LessonProgress, "lesson_id" | "status">;

/** Mapa slug -> estado, para consultas O(1). */
export function buildStatusMap(progress: ProgressRow[]): Map<string, LessonStatus> {
  return new Map(progress.map((p) => [p.lesson_id, p.status]));
}

// ---------------------------------------------------------------------------
// Contenido gratuito
// ---------------------------------------------------------------------------

/**
 * Mínimo de lecciones gratuitas por categoría.
 *
 * La regla base es "el primer módulo de cada categoría", pero algunos módulos
 * iniciales son muy cortos (2 lecciones), lo que dejaría una muestra demasiado
 * pequeña para decidir si suscribirse. Este mínimo garantiza una prueba real.
 */
export const FREE_LESSONS_PER_CATEGORY = 3;

/**
 * Lecciones gratuitas de una categoría: las del primer módulo y, si son menos
 * que `FREE_LESSONS_PER_CATEGORY`, se completa con las siguientes de la
 * categoría hasta llegar a ese mínimo.
 */
function freeLessonsOfCategory(category: Category): Lesson[] {
  const modules = getModulesByCategory(category);
  const firstModuleSize = modules[0]?.module.lessons.length ?? 0;
  const take = Math.max(firstModuleSize, FREE_LESSONS_PER_CATEGORY);
  return getLessonsByCategory(category).slice(0, take);
}

/**
 * Slugs accesibles sin suscripción. Es un prefijo de cada categoría, así que el
 * estudiante gratuito recorre el inicio de ambas rutas antes de toparse con el
 * muro de pago.
 */
export function getFreeLessonSlugs(): Set<string> {
  return new Set(
    CATEGORIES.flatMap((category) => freeLessonsOfCategory(category)).map((l) => l.slug),
  );
}

/** True si la lección requiere membresía Premium (está fuera del tier gratuito). */
export function isPremiumLesson(slug: string): boolean {
  return !getFreeLessonSlugs().has(slug);
}

// ---------------------------------------------------------------------------
// Cálculo de acceso
// ---------------------------------------------------------------------------

/** Reparto de todas las lecciones según qué candado (si alguno) las cubre. */
export interface LessonAccess {
  /** Lecciones en las que el estudiante puede entrar ahora mismo. */
  unlocked: Set<string>;
  /** Lecciones bloqueadas por falta de suscripción (👑, llevan a /pricing). */
  premiumLocked: Set<string>;
}

/**
 * Calcula el acceso del estudiante a todo el currículum.
 *
 * @param statusBySlug progreso del estudiante (ver `buildStatusMap`).
 * @param hasPremium   si su suscripción le da acceso completo
 *                     (ver `hasPremiumAccess` en `lib/subscription`).
 *
 * Con suscripción, la regla secuencial se aplica a las 86 lecciones. Sin ella,
 * se aplica solo dentro del contenido gratuito y el resto queda como Premium.
 *
 * Una lección está desbloqueada (dentro del tramo que le corresponde) si:
 *  1. es la **primera** de su categoría, o
 *  2. ya tiene progreso propio (`in_progress` o `completed`) — nadie pierde el
 *     acceso a algo que ya había empezado, o
 *  3. la lección **inmediatamente anterior** de su categoría está completada.
 */
export function getLessonAccess(
  statusBySlug: Map<string, LessonStatus>,
  hasPremium: boolean,
): LessonAccess {
  const unlocked = new Set<string>();
  const premiumLocked = new Set<string>();
  // Con suscripción no hay muro de pago que evaluar.
  const freeSlugs = hasPremium ? null : getFreeLessonSlugs();

  for (const category of CATEGORIES) {
    // La primera de cada categoría siempre está abierta.
    let previousCompleted = true;

    for (const lesson of getLessonsByCategory(category)) {
      // El muro de pago se evalúa primero: prevalece sobre el progreso previo.
      if (freeSlugs && !freeSlugs.has(lesson.slug)) {
        premiumLocked.add(lesson.slug);
        // Una lección de pago no se puede completar, así que no desbloquea nada.
        previousCompleted = false;
        continue;
      }

      const status = statusBySlug.get(lesson.slug) ?? "not_started";
      if (previousCompleted || status !== "not_started") unlocked.add(lesson.slug);
      previousCompleted = status === "completed";
    }
  }

  return { unlocked, premiumLocked };
}

/** Slugs de las lecciones a las que el estudiante puede entrar. */
export function getUnlockedLessonSlugs(
  statusBySlug: Map<string, LessonStatus>,
  hasPremium: boolean,
): Set<string> {
  return getLessonAccess(statusBySlug, hasPremium).unlocked;
}

/** True si el estudiante puede abrir esa lección. Slug inexistente → false. */
export function isLessonUnlocked(
  slug: string,
  statusBySlug: Map<string, LessonStatus>,
  hasPremium: boolean,
): boolean {
  return getLessonAccess(statusBySlug, hasPremium).unlocked.has(slug);
}

/**
 * Por qué está bloqueada una lección, para que quien protege la URL sepa a
 * dónde mandar al estudiante:
 *   `null`      — no está bloqueada.
 *   `"premium"` — necesita suscripción → /pricing.
 *   `"sequence"`— necesita completar la anterior → /dashboard.
 */
export type LockReason = "premium" | "sequence";

export function getLockReason(
  slug: string,
  statusBySlug: Map<string, LessonStatus>,
  hasPremium: boolean,
): LockReason | null {
  const access = getLessonAccess(statusBySlug, hasPremium);
  if (access.unlocked.has(slug)) return null;
  return access.premiumLocked.has(slug) ? "premium" : "sequence";
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
