// =============================================================================
// Convalidación por categoría y nivel: dónde empieza el estudiante.
//
// El Test de Diagnóstico no solo etiqueta el perfil: coloca al estudiante en el
// punto del programa que le corresponde. Los módulos que ya domina se marcan
// como `completed` en `lesson_progress`, con lo que el candado secuencial de
// `lib/progression` los da por superados y abre el siguiente.
//
// La convalidación es POR CATEGORÍA, igual que el test: rendir el diagnóstico de
// Inversiones convalida módulos de Inversiones y no toca Finanzas Personales, ni
// al revés. Antes un solo nivel promedio abría módulos de las dos rutas, de modo
// que acertar preguntas de presupuesto podía saltarse "Fundamentos de la
// inversión". Ahora cada categoría responde solo por lo que se midió en ella.
//
// Reglas de diseño:
//
//  1. Se convalida un PREFIJO de la categoría, nunca módulos sueltos. El candado
//     secuencial mira la lección inmediatamente anterior, así que un hueco
//     intermedio dejaría contenido inalcanzable. Por eso la configuración es
//     "cuántos módulos iniciales", y no una lista de slugs que alguien pueda
//     reordenar sin darse cuenta.
//
//  2. Solo se convalida lo que el test realmente mide (fundamentos, ahorro,
//     presupuesto, deuda e interés en Finanzas Personales; fundamentos de la
//     inversión y diversificación en Inversiones). Un 75% en 10 preguntas no
//     acredita las 86 lecciones del programa, así que la convalidación está
//     acotada a propósito.
//
//  3. La escala es monótona dentro de cada categoría: lo que convalida Intermedio
//     lo convalida también Avanzado. Repetir el test y subir de nivel solo puede
//     AÑADIR módulos.
//
// El muro de pago no entra aquí: una lección puede quedar convalidada y aun así
// mostrarse con 👑 si no hay suscripción (en `getLessonAccess` el candado de
// pago manda). Es lo correcto: el diagnóstico acredita conocimiento, no acceso.
// =============================================================================

import { getModulesByCategory, type Category, type Module } from "@/lib/curriculum";
import type { FinancialLevel } from "@/lib/types";

/**
 * Cuántos módulos iniciales convalida cada nivel, dentro de cada categoría.
 *
 * Con el currículum actual eso significa:
 *
 *   Finanzas Personales
 *     Intermedio → "Mentalidad y hábitos" + "Ahorro y emergencias".
 *                  Sigue en "Deuda e interés".
 *     Avanzado   → lo anterior + "Deuda e interés": la ruta de Fundamentos
 *                  completa. Sigue en "El presupuesto en la práctica".
 *
 *   Inversiones
 *     Intermedio → "Fundamentos de la inversión".
 *                  Sigue en "Diversificación y tipos de activos".
 *     Avanzado   → lo anterior + "Diversificación y tipos de activos": la ruta
 *                  introductoria completa. Sigue en "Renta variable: acciones",
 *                  ya dentro de instrumentos.
 */
const VALIDATED_MODULES: Record<Category, Record<FinancialLevel, number>> = {
  "Finanzas Personales": { beginner: 0, intermediate: 2, advanced: 3 },
  Inversiones: { beginner: 0, intermediate: 1, advanced: 2 },
};

/** Módulo reducido a lo que necesitan el mensaje de resultado y los enlaces. */
export interface PlacementModule {
  slug: string;
  title: string;
  category: Category;
  lessonCount: number;
}

/** Dónde queda situado el estudiante en UNA categoría con un nivel dado. */
export interface Placement {
  category: Category;
  /** Módulos que el nivel da por superados (vacío en Principiante). */
  modules: PlacementModule[];
  /** Slugs de todas sus lecciones, que es lo que se escribe en el progreso. */
  lessonSlugs: string[];
  /**
   * Módulo por el que continúa: el primero NO convalidado de la categoría.
   * `null` solo si el currículum se quedara sin módulos ahí.
   */
  nextModule: PlacementModule | null;
}

function toPlacementModule(module: Module): PlacementModule {
  return {
    slug: module.slug,
    title: module.title,
    category: module.category,
    lessonCount: module.lessons.length,
  };
}

/**
 * Calcula la convalidación de un nivel dentro de una categoría. Es una función
 * pura del currículum: el servidor la usa para escribir el progreso y la UI para
 * redactar el mensaje, de modo que ambos digan exactamente lo mismo.
 */
export function getPlacementForCategory(
  category: Category,
  level: FinancialLevel,
): Placement {
  const quota = VALIDATED_MODULES[category][level];
  const categoryModules = getModulesByCategory(category).map(({ module }) => module);
  const validated = categoryModules.slice(0, quota);

  return {
    category,
    modules: validated.map(toPlacementModule),
    lessonSlugs: validated.flatMap((module) => module.lessons.map((lesson) => lesson.slug)),
    nextModule: categoryModules[quota] ? toPlacementModule(categoryModules[quota]) : null,
  };
}

/** Cuántas lecciones convalida un nivel en una categoría (para copys y tests). */
export function countValidatedLessons(category: Category, level: FinancialLevel): number {
  return getPlacementForCategory(category, level).lessonSlugs.length;
}
