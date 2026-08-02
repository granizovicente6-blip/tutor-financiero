import { createClient } from "@/lib/supabase/server";
import { ChatApp } from "@/components/ChatApp";
import { Landing } from "@/components/Landing";
import { getCurriculumStats } from "@/lib/curriculum";
import { getFreeLessonSlugs } from "@/lib/progression";
import { formatPlanPrice, PREMIUM_PLAN } from "@/lib/subscription";
import type { Conversation, FinancialLevel, StreakInfo } from "@/lib/types";

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

  const [{ data: conversations }, { data: profile }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("financial_level, current_streak, longest_streak")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const streak: StreakInfo = {
    current: profile?.current_streak ?? 0,
    longest: profile?.longest_streak ?? 0,
  };

  return (
    <ChatApp
      initialConversations={(conversations ?? []) as Conversation[]}
      userEmail={user.email ?? ""}
      initialLevel={(profile?.financial_level ?? null) as FinancialLevel | null}
      streak={streak}
    />
  );
}
