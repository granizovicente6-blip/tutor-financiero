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
  getLessonAccess,
  getPreviousLessonInCategory,
} from "@/lib/progression";
import { getSubscription, hasPremiumAccess } from "@/lib/subscription";
import { loginPath } from "@/lib/auth-redirect";
import type { FinancialLevel, LessonProgress } from "@/lib/types";

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
    redirect(loginPath("/dashboard"));
  }

  const [{ data }, { data: profile }, subscription] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, status, completed_at, quiz_score"),
    supabase.from("profiles").select("financial_level").eq("id", user.id).maybeSingle(),
    getSubscription(supabase, user.id),
  ]);

  const progress = (data ?? []) as LessonProgress[];
  const statusBySlug = buildStatusMap(progress);
  const isPremium = hasPremiumAccess(subscription);
  // Dos conjuntos distintos: lo que puede abrir y lo que exige membresía. El
  // dashboard los pinta con candados diferentes (🔒 estudiar vs 👑 suscribirse).
  const { unlocked, premiumLocked } = getLessonAccess(statusBySlug, isPremium);

  // Aviso cuando se intentó entrar por URL a una lección aún bloqueada. Se
  // vuelve a verificar el candado aquí: el parámetro viene de la URL y no es
  // de fiar por sí solo. (Las bloqueadas por suscripción no llegan aquí: la
  // página de la lección las manda a /pricing.)
  const blockedSlug = searchParams.bloqueada;
  const blocked = blockedSlug ? getLessonBySlug(blockedSlug) : null;
  const showNotice = blocked !== null && !unlocked.has(blocked.lesson.slug);

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
      unlockedSlugs={[...unlocked]}
      premiumLockedSlugs={[...premiumLocked]}
      isPremium={isPremium}
      financialLevel={(profile?.financial_level ?? null) as FinancialLevel | null}
      initialCategory={blocked && showNotice ? blocked.module.category : undefined}
      lockedNotice={lockedNotice}
      userEmail={user.email ?? ""}
    />
  );
}
