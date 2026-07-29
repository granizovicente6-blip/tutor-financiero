import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatApp } from "@/components/ChatApp";
import type { Conversation, FinancialLevel, StreakInfo } from "@/lib/types";

/**
 * Página principal (Server Component).
 * - Exige sesión: si no hay usuario, redirige a /login (defensa en profundidad
 *   además del middleware).
 * - Carga las conversaciones del usuario para la barra lateral.
 * - Renderiza la app de chat (cliente) con esos datos iniciales.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
