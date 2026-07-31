import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Dashboard,
  type CategorySection,
  type LockedNotice,
} from "@/components/Dashboard";
import { getLessonBySlug, getModulesGroupedByCategory } from "@/lib/curriculum";
import {
  buildStatusMap,
  getPreviousLessonInCategory,
  getUnlockedLessonSlugs,
} from "@/lib/progression";
import type { LessonProgress } from "@/lib/types";

interface DashboardPageProps {
  /** `?bloqueada=<slug>`: llega así quien intentó abrir una lección con candado. */
  searchParams: { bloqueada?: string };
}

/**
 * Currículum reducido a lo que muestra el dashboard.
 *
 * El dashboard es un componente de cliente (las pestañas llevan estado), así que
 * todo lo que se le pase viaja serializado al navegador. Dejamos fuera el
 * contenido markdown y los quizzes: solo los necesita la página de la lección.
 */
function getCategorySections(): CategorySection[] {
  return getModulesGroupedByCategory().map(({ category, modules }) => ({
    category,
    modules: modules.map(({ path, module }) => ({
      slug: module.slug,
      title: module.title,
      description: module.description,
      pathTitle: path.title,
      lessons: module.lessons.map((lesson) => ({
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
      })),
    })),
  }));
}

/**
 * Página del Dashboard del estudiante (Server Component).
 * - Exige sesión (defensa en profundidad además del middleware).
 * - Carga el progreso del usuario y lo combina con el currículum (en código),
 *   agrupado en las dos categorías principales ("Finanzas Personales" e
 *   "Inversiones"), que el dashboard muestra como pestañas.
 * - Calcula aquí qué lecciones están desbloqueadas: el cliente solo las pinta.
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status, completed_at, quiz_score");

  const progress = (data ?? []) as LessonProgress[];
  const statusBySlug = buildStatusMap(progress);
  const unlockedSlugs = getUnlockedLessonSlugs(statusBySlug);

  // Aviso cuando se intentó entrar por URL a una lección aún bloqueada. Se
  // vuelve a verificar el candado aquí: el parámetro viene de la URL y no es
  // de fiar por sí solo.
  const blockedSlug = searchParams.bloqueada;
  const blocked = blockedSlug ? getLessonBySlug(blockedSlug) : null;
  const showNotice = blocked !== null && !unlockedSlugs.has(blocked.lesson.slug);

  const lockedNotice: LockedNotice | null =
    blocked && showNotice
      ? {
          lessonTitle: blocked.lesson.title,
          requiredTitle: getPreviousLessonInCategory(blocked.lesson.slug)?.title ?? null,
        }
      : null;

  return (
    <Dashboard
      categories={getCategorySections()}
      progress={progress}
      unlockedSlugs={[...unlockedSlugs]}
      initialCategory={blocked && showNotice ? blocked.module.category : undefined}
      lockedNotice={lockedNotice}
      userEmail={user.email ?? ""}
    />
  );
}
