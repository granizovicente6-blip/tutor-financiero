import { createClient } from "@/lib/supabase/server";
import { ChatApp } from "@/components/ChatApp";
import { Landing } from "@/components/Landing";
import { getCurriculumStats } from "@/lib/curriculum";
import { getFreeLessonSlugs } from "@/lib/progression";
import { getStreak } from "@/lib/streak";
import {
  formatPlanPrice,
  getSubscription,
  hasPremiumAccess,
  PREMIUM_PLAN,
} from "@/lib/subscription";
import type { Conversation, FinancialLevel } from "@/lib/types";

/**
 * Página principal (Server Component). Es pública: la puerta de entrada del
 * modelo guest-first.
 *
 * - Sin sesión: portada informativa con los CTA hacia registro/login.
 * - Con sesión: la app de chat, con las conversaciones del usuario ya cargadas.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { lessonCount, moduleCount } = getCurriculumStats();
    return (
      <Landing
        isAuthenticated={false}
        lessonCount={lessonCount}
        moduleCount={moduleCount}
        freeLessonCount={getFreeLessonSlugs().size}
        priceLabel={formatPlanPrice()}
        currencyLabel={PREMIUM_PLAN.currencyId}
      />
    );
  }

  // getStreak() no es un SELECT más: valida la racha contra la fecha de hoy y la
  // reinicia si caducó. Al pasar por aquí en cada carga de la app (y por tanto
  // justo después de iniciar sesión), una racha abandonada se apaga sola.
  const [{ data: conversations }, { data: profile }, streak, subscription] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("financial_level")
      .eq("id", user.id)
      .maybeSingle(),
    getStreak(supabase, user.id),
    getSubscription(supabase, user.id),
  ]);

  return (
    <ChatApp
      initialConversations={(conversations ?? []) as Conversation[]}
      userEmail={user.email ?? ""}
      level={(profile?.financial_level ?? null) as FinancialLevel | null}
      streak={streak}
      isPremium={hasPremiumAccess(subscription)}
    />
  );
}
