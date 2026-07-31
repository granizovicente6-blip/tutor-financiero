import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard, type CategorySection } from "@/components/Dashboard";
import { getModulesGroupedByCategory } from "@/lib/curriculum";
import type { LessonProgress } from "@/lib/types";

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
 */
export default async function DashboardPage() {
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

  return (
    <Dashboard
      categories={getCategorySections()}
      progress={progress}
      userEmail={user.email ?? ""}
    />
  );
}
