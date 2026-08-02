import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Dashboard,
  type CategorySection,
  type LockedNotice,
} from "@/components/Dashboard";
import {
  CATEGORIES,
  getLessonBySlug,
  getModuleBySlug,
  getModulesGroupedByCategory,
  type Category,
} from "@/lib/curriculum";
import {
  buildStatusMap,
  getLessonAccess,
  getPreviousLessonInCategory,
} from "@/lib/progression";
import { getSubscription, hasPremiumAccess } from "@/lib/subscription";
import { loginPath } from "@/lib/auth-redirect";
import type { FinancialLevel, LessonProgress } from "@/lib/types";

interface DashboardPageProps {
  searchParams: {
    /** `?bloqueada=<slug>`: llega así quien intentó abrir una lección con candado. */
    bloqueada?: string;
    /** `?modulo=<slug>`: abre la ruta en ese módulo (viene del test de diagnóstico). */
    modulo?: string;
    /**
     * `?categoria=<nombre>`: abre esa pestaña. Lo manda el test de diagnóstico
     * junto con `modulo`, para que terminar el test de Inversiones aterrice en
     * Inversiones aunque la categoría ya esté entera convalidada y no haya
     * módulo siguiente al que apuntar.
     */
    categoria?: string;
  };
}

/** Valida el `?categoria=` de la URL contra el currículum (no es de fiar). */
function parseCategory(value: string | undefined): Category | null {
  return CATEGORIES.find((category) => category === value) ?? null;
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

  // Módulo al que apunta el enlace del test de diagnóstico. El slug viene de la
  // URL, así que se resuelve contra el currículum antes de usarlo: si no existe,
  // simplemente no se destaca nada.
  const highlighted = searchParams.modulo ? getModuleBySlug(searchParams.modulo) : null;

  // El aviso de lección bloqueada manda sobre el destacado: quien llega ahí
  // necesita ver la lección que le falta, no el módulo que venía enlazado.
  // Entre los dos parámetros del diagnóstico manda el módulo: si viene, su
  // categoría es por definición la correcta.
  const initialCategory =
    blocked && showNotice
      ? blocked.module.category
      : (highlighted?.category ?? parseCategory(searchParams.categoria) ?? undefined);

  return (
    <Dashboard
      categories={getCategorySections()}
      progress={progress}
      unlockedSlugs={[...unlocked]}
      premiumLockedSlugs={[...premiumLocked]}
      isPremium={isPremium}
      financialLevel={(profile?.financial_level ?? null) as FinancialLevel | null}
      initialCategory={initialCategory}
      highlightModuleSlug={highlighted?.slug ?? null}
      lockedNotice={lockedNotice}
      userEmail={user.email ?? ""}
    />
  );
}
