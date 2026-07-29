import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/Dashboard";
import { LEARNING_PATHS } from "@/lib/curriculum";
import type { LessonProgress } from "@/lib/types";

interface DashboardPageProps {
  searchParams: { ruta?: string };
}

/**
 * Página del Dashboard del estudiante (Server Component).
 * - Exige sesión (defensa en profundidad además del middleware).
 * - Carga el progreso del usuario y lo combina con el currículum (en código)
 *   para mostrar las rutas con su avance. La ruta activa se elige por el
 *   parámetro `?ruta=<slug>` (por defecto, la primera).
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

  const activePathSlug =
    LEARNING_PATHS.find((p) => p.slug === searchParams.ruta)?.slug ?? LEARNING_PATHS[0].slug;

  return (
    <Dashboard
      paths={LEARNING_PATHS}
      activePathSlug={activePathSlug}
      progress={progress}
      userEmail={user.email ?? ""}
    />
  );
}
