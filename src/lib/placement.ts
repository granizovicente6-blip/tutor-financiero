// =============================================================================
// Convalidación por nivel: dónde empieza el estudiante según el diagnóstico.
//
// El Test de Diagnóstico no solo etiqueta el perfil: coloca al estudiante en el
// punto del programa que le corresponde. Los módulos que ya domina se marcan
// como `completed` en `lesson_progress`, con lo que el candado secuencial de
// `lib/progression` los da por superados y abre el siguiente.
//
// Reglas de diseño:
//
//  1. Se convalida un PREFIJO de cada categoría, nunca módulos sueltos. El
//     candado secuencial mira la lección inmediatamente anterior, así que un
//     hueco intermedio dejaría contenido inalcanzable. Por eso la configuración
//     es "cuántos módulos iniciales", y no una lista de slugs que alguien pueda
//     reordenar sin darse cuenta.
//
//  2. Solo se convalida lo que el test realmente mide (fundamentos, ahorro,
//     presupuesto, interés compuesto y la introducción a invertir). Un 75% en
//     10 preguntas no acredita las 86 lecciones del programa, así que la
//     convalidación está acotada a propósito.
//
//  3. La escala es monótona: lo que convalida Intermedio lo convalida también
//     Avanzado. Repetir el test y subir de nivel solo puede AÑADIR módulos.
//
// El muro de pago no entra aquí: una lección puede quedar convalidada y aun así
// mostrarse con 👑 si no hay suscripción (en `getLessonAccess` el candado de
// pago manda). Es lo correcto: el diagnóstico acredita conocimiento, no acceso.
// =============================================================================

import {
  CATEGORIES,
  getModulesByCategory,
  type Category,
  type Module,
} from "@/lib/curriculum";
import type { FinancialLevel } from "@/lib/types";

/**
 * Cuántos módulos iniciales de cada categoría convalida cada nivel.
 *
 * Con el currículum actual eso significa:
 *
 *   Intermedio → Finanzas Personales: "Mentalidad y hábitos" + "Ahorro y
 *                emergencias"; Inversiones: "Fundamentos de la inversión".
 *                Sigue en "Deuda e interés".
 *
 *   Avanzado   → lo anterior + "Deuda e interés" y "Diversificación y tipos de
 *                activos": las dos rutas introductorias completas. Sigue en
 *                "Renta variable: acciones", ya dentro de instrumentos.
 */
const VALIDATED_MODULES: Record<FinancialLevel, Record<Category, number>> = {
  beginner: { "Finanzas Personales": 0, Inversiones: 0 },
  intermediate: { "Finanzas Personales": 2, Inversiones: 1 },
  advanced: { "Finanzas Personales": 3, Inversiones: 2 },
};

/**
 * Categoría por la que se le invita a seguir. El principiante y el intermedio
 * siguen construyendo base en Finanzas Personales; al avanzado lo mandamos a
 * Inversiones, que es donde empieza el contenido nuevo para él.
 */
const LANDING_CATEGORY: Record<FinancialLevel, Category> = {
  beginner: "Finanzas Personales",
  intermediate: "Finanzas Personales",
  advanced: "Inversiones",
};

/** Módulo reducido a lo que necesitan el mensaje de resultado y los enlaces. */
export interface PlacementModule {
  slug: string;
  title: string;
  category: Category;
  lessonCount: number;
}

/** Dónde queda situado el estudiante con un nivel dado. */
export interface Placement {
  /** Módulos que el nivel da por superados (vacío en Principiante). */
  modules: PlacementModule[];
  /** Slugs de todas sus lecciones, que es lo que se escribe en el progreso. */
  lessonSlugs: string[];
  /**
   * Módulo por el que continúa: el primero NO convalidado de su categoría de
   * aterrizaje. `null` solo si el currículum se quedara sin módulos ahí.
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
 * Calcula la convalidación de un nivel. Es una función pura del currículum: el
 * servidor la usa para escribir el progreso y la UI para redactar el mensaje,
 * de modo que ambos digan exactamente lo mismo.
 */
export function getPlacementForLevel(level: FinancialLevel): Placement {
  const quota = VALIDATED_MODULES[level];
  const modules: PlacementModule[] = [];

  for (const category of CATEGORIES) {
    const categoryModules = getModulesByCategory(category).map(({ module }) => module);
    modules.push(...categoryModules.slice(0, quota[category]).map(toPlacementModule));
  }

  const landing = LANDING_CATEGORY[level];
  const landingModules = getModulesByCategory(landing).map(({ module }) => module);
  const next = landingModules[quota[landing]] ?? null;

  return {
    modules,
    lessonSlugs: CATEGORIES.flatMap((category) =>
      getModulesByCategory(category)
        .slice(0, quota[category])
        .flatMap(({ module }) => module.lessons.map((lesson) => lesson.slug)),
    ),
    nextModule: next ? toPlacementModule(next) : null,
  };
}

/** Cuántas lecciones convalida un nivel (para copys y comparaciones). */
export function countValidatedLessons(level: FinancialLevel): number {
  return getPlacementForLevel(level).lessonSlugs.length;
}
