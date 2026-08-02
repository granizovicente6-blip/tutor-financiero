import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonView } from "@/components/LessonView";
import { getAdjacentLessons, getLessonBySlug } from "@/lib/curriculum";
import { buildStatusMap, getLockReason, isLessonUnlocked } from "@/lib/progression";
import { getSubscription, hasPremiumAccess } from "@/lib/subscription";
import { loginPath } from "@/lib/auth-redirect";
import type { LessonProgress, LessonStatus } from "@/lib/types";

interface LessonPageProps {
  params: { lessonSlug: string };
}

/**
 * Página de una lección individual (Server Component).
 * - Resuelve el contenido desde el currículum en código (404 si no existe).
 * - Exige sesión y carga el progreso del usuario.
 * - Protege el acceso secuencial: si la lección aún está bloqueada, devuelve al
 *   dashboard con un aviso. Es la barrera real; el candado del dashboard es solo
 *   la señal visual y no impide escribir la URL a mano.
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
    redirect(loginPath(`/dashboard/${params.lessonSlug}`));
  }

  // Se carga el progreso completo (no solo esta lección) porque el desbloqueo
  // depende del estado de la lección anterior.
  const [{ data }, subscription] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, status, quiz_score"),
    getSubscription(supabase, user.id),
  ]);

  const progress = (data ?? []) as Pick<
    LessonProgress,
    "lesson_id" | "status" | "quiz_score"
  >[];

  const isPremium = hasPremiumAccess(subscription);
  const statusBySlug = buildStatusMap(progress);

  // Barrera real de acceso (el candado del dashboard es solo la señal visual y
  // no impide escribir la URL a mano). Cada candado lleva a un sitio distinto:
  // el de suscripción a /pricing, el secuencial al dashboard.
  const lock = getLockReason(params.lessonSlug, statusBySlug, isPremium);
  if (lock === "premium") {
    redirect(`/pricing?leccion=${encodeURIComponent(params.lessonSlug)}`);
  }
  if (lock === "sequence") {
    redirect(`/dashboard?bloqueada=${encodeURIComponent(params.lessonSlug)}`);
  }

  const current = progress.find((row) => row.lesson_id === params.lessonSlug);
  const initialStatus = (current?.status ?? "not_started") as LessonStatus;
  const initialScore = current?.quiz_score ?? null;
  const { prev, next } = getAdjacentLessons(params.lessonSlug);
  const { path, module, lesson } = found;

  // La siguiente lección se desbloquea al completar esta, así que mientras tanto
  // el enlace se muestra con candado en lugar de llevar a un redirect.
  const nextLocked =
    next !== null && !isLessonUnlocked(next.slug, statusBySlug, isPremium);

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
      nextLocked={nextLocked}
    />
  );
}
