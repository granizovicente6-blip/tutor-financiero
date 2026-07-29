import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonView } from "@/components/LessonView";
import { getAdjacentLessons, getLessonBySlug } from "@/lib/curriculum";
import type { LessonStatus } from "@/lib/types";

interface LessonPageProps {
  params: { lessonSlug: string };
}

/**
 * Página de una lección individual (Server Component).
 * - Resuelve el contenido desde el currículum en código (404 si no existe).
 * - Exige sesión y carga el estado de progreso del usuario para esta lección.
 */
export default async function LessonPage({ params }: LessonPageProps) {
  const found = getLessonBySlug(params.lessonSlug);
  if (!found) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("lesson_progress")
    .select("status, quiz_score")
    .eq("lesson_id", params.lessonSlug)
    .maybeSingle();

  const initialStatus = (data?.status ?? "not_started") as LessonStatus;
  const initialScore = (data?.quiz_score ?? null) as number | null;
  const { prev, next } = getAdjacentLessons(params.lessonSlug);
  const { path, module, lesson } = found;

  return (
    <LessonView
      lessonSlug={lesson.slug}
      title={lesson.title}
      summary={lesson.summary}
      estimatedMinutes={lesson.estimatedMinutes}
      moduleTitle={module.title}
      pathTitle={path.title}
      content={lesson.content}
      initialStatus={initialStatus}
      quiz={lesson.quiz ?? null}
      initialScore={initialScore}
      prev={prev ? { slug: prev.slug, title: prev.title } : null}
      next={next ? { slug: next.slug, title: next.title } : null}
    />
  );
}
