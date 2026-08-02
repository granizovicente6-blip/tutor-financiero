import { createClient } from "@/lib/supabase/server";
import { Pricing, type PlanBenefit } from "@/components/Pricing";
import { getCurriculumStats, getLessonBySlug } from "@/lib/curriculum";
import { getFreeLessonSlugs } from "@/lib/progression";
import {
  formatPlanPrice,
  FREE_SUBSCRIPTION,
  getSubscription,
  hasPremiumAccess,
  PREMIUM_PLAN,
} from "@/lib/subscription";
import { isTestMode } from "@/lib/mercadopago";

interface PricingPageProps {
  searchParams: {
    /** `?leccion=<slug>`: llega así quien topó con el muro de pago. */
    leccion?: string;
    /** `?estado=procesando`: vuelta desde el checkout de Mercado Pago. */
    estado?: string;
  };
}

/** Fecha legible para el usuario ("1 de septiembre de 2026"). */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(date);
}

/**
 * Página de precios (Server Component). Es pública: el precio se puede
 * consultar sin cuenta.
 *
 * Suscribirse sí requiere una cuenta a la que asociar el pago, así que al
 * visitante anónimo se le muestra el mismo plan pero con un CTA de registro
 * (ver `isAuthenticated` en `Pricing`).
 *
 * Las cifras del plan (lecciones, módulos) se calculan del currículum real, para
 * que la oferta no se desalinee del contenido al ampliarlo.
 */
export default async function PricingPage({ searchParams }: PricingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión no hay perfil que leer: se muestra el estado gratuito.
  const subscription = user ? await getSubscription(supabase, user.id) : FREE_SUBSCRIPTION;

  const { lessonCount, moduleCount } = getCurriculumStats();
  const freeLessonCount = getFreeLessonSlugs().size;

  const benefits: PlanBenefit[] = [
    {
      icon: "📚",
      title: `Acceso ilimitado a las ${lessonCount} lecciones`,
      description:
        "Todo el programa de Finanzas Personales e Inversiones, de los fundamentos a los temas avanzados.",
    },
    {
      icon: "🗂️",
      title: `${moduleCount} módulos en 2 rutas completas`,
      description:
        "Progresión ordenada: cada módulo se apoya en el anterior, sin saltos ni huecos.",
    },
    {
      icon: "🤖",
      title: "Tutor de IA sin límites",
      description:
        "Pregunta cualquier duda y recibe explicaciones socráticas adaptadas a tu nivel, cuando lo necesites.",
    },
    {
      icon: "🧮",
      title: "Simuladores y quizzes con retroalimentación",
      description:
        "Interés compuesto, presupuesto 50/30/20 y evaluaciones con feedback personalizado del tutor.",
    },
    {
      icon: "🔥",
      title: "Seguimiento de progreso y rachas",
      description:
        "Tu avance por categoría y tu racha de estudio, para sostener el hábito semana a semana.",
    },
    {
      icon: "🆕",
      title: "Contenido nuevo incluido",
      description:
        "Las lecciones que se añadan al programa entran en tu membresía sin costo extra.",
    },
  ];

  const blocked = searchParams.leccion ? getLessonBySlug(searchParams.leccion) : null;

  return (
    <Pricing
      isAuthenticated={user !== null}
      priceLabel={formatPlanPrice()}
      currencyLabel={PREMIUM_PLAN.currencyId}
      planName={PREMIUM_PLAN.name}
      benefits={benefits}
      subscriptionStatus={subscription.status}
      hasPremium={hasPremiumAccess(subscription)}
      periodEndLabel={formatDate(subscription.currentPeriodEnd)}
      blockedLessonTitle={blocked?.lesson.title ?? null}
      returningFromCheckout={searchParams.estado === "procesando"}
      testMode={isTestMode()}
      freeLessonCount={freeLessonCount}
    />
  );
}
