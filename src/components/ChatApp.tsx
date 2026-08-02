"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/auth/actions";
import { updateFinancialLevel } from "@/app/profile/actions";
import type { ChatMessage, Conversation, FinancialLevel, StreakInfo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------------
const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "¡Hola! Soy tu **Tutor de Educación Financiera**. Estoy aquí para ayudarte a desarrollar criterio propio mediante preguntas y analogías del día a día.\n\nPuedes pedirme que te explique un concepto (interés compuesto, diversificación, inflación...) o plantearme una duda. Recuerda: mi objetivo es que **aprendas a pensar**, no darte recomendaciones de inversión.\n\n¿Sobre qué te gustaría empezar a aprender hoy?",
};

const ERROR_MESSAGE =
  "⚠️ Lo siento, ha ocurrido un problema al generar la respuesta. Por favor, inténtalo de nuevo en unos segundos.";

const LEVEL_LABELS: Record<FinancialLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

// ---------------------------------------------------------------------------
// Render de Markdown (respuestas del tutor) con estilos Tailwind
// ---------------------------------------------------------------------------
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-lg font-bold text-slate-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-base font-bold text-slate-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-900 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-3 border-t border-slate-200" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-emerald-300 pl-3 italic text-slate-600">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
};

function MarkdownMessage({ content }: { content: string }): ReactNode {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function TypingIndicator(): ReactNode {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="El tutor está escribiendo">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
interface ChatAppProps {
  initialConversations: Conversation[];
  userEmail: string;
  initialLevel: FinancialLevel | null;
  /** Racha de estudio; se renderiza directo desde props para reflejar cambios. */
  streak: StreakInfo;
  /** True si la membresía está activa: cambia el CTA por un distintivo. */
  isPremium: boolean;
}

export function ChatApp({
  initialConversations,
  userEmail,
  initialLevel,
  streak,
  isPremium,
}: ChatAppProps) {
  const [supabase] = useState(() => createClient());

  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [level, setLevel] = useState<FinancialLevel | null>(initialLevel);
  const [savingLevel, setSavingLevel] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refreshConversations(): Promise<void> {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });
    if (data) setConversations(data as Conversation[]);
  }

  async function changeLevel(next: FinancialLevel): Promise<void> {
    if (next === level || savingLevel) return;
    const previous = level;
    setLevel(next); // actualización optimista
    setSavingLevel(true);
    const result = await updateFinancialLevel(next);
    setSavingLevel(false);
    if (!result.ok) {
      setLevel(previous); // revertir si falló
    }
  }

  function startNewChat(): void {
    setCurrentId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setSidebarOpen(false);
  }

  async function selectConversation(id: string): Promise<void> {
    if (id === currentId || isLoading) return;
    setCurrentId(id);
    setSidebarOpen(false);
    setMessages([]);

    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    const loaded: ChatMessage[] = (data ?? []).map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));
    setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE]);
  }

  async function sendMessage(): Promise<void> {
    const trimmed = input.trim();
    if (trimmed === "" || isLoading) return;

    const wasNew = currentId === null;
    const userMessage: ChatMessage = { role: "user", content: trimmed };

    // En un chat nuevo descartamos el mensaje de bienvenida (solo UI).
    setMessages((prev) => [
      ...(wasNew ? [] : prev),
      userMessage,
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: currentId, content: trimmed }),
      });

      // Límite de solicitudes alcanzado: mensaje específico y claro.
      if (response.status === 429) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        const message =
          data?.error ?? "Has alcanzado el límite de solicitudes. Espera unos segundos.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: `⏳ ${message}` };
          return updated;
        });
        return;
      }

      if (!response.ok || response.body === null) {
        throw new Error(`Respuesta no válida del servidor (${response.status}).`);
      }

      // El servidor nos indica el id de la conversación (nueva o existente).
      const convId = response.headers.get("X-Conversation-Id");
      if (convId && currentId === null) {
        setCurrentId(convId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }

      // Si era una conversación nueva, refrescamos la lista para que aparezca
      // en la barra lateral con su título.
      if (wasNew) {
        await refreshConversations();
      }
    } catch (error) {
      console.error("[chat] Error al obtener la respuesta:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: ERROR_MESSAGE };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex h-dvh bg-slate-100 text-slate-800">
      {/* Backdrop del sidebar en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-slate-200 bg-white md:static md:z-auto md:flex`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
            📊
          </span>
          <span className="text-sm font-semibold text-slate-900">Tutor Financiero</span>
        </div>

        <div className="flex flex-col gap-2 p-3">
          <button
            onClick={startNewChat}
            className="w-full rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            + Nuevo chat
          </button>
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            📚 Mi ruta de aprendizaje
          </Link>
          <Link
            href="/simuladores"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            🧮 Simuladores
          </Link>
        </div>

        {/* Resumen de racha */}
        <div className="px-3 pb-1">
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
            {streak.current > 0 ? (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                  🔥 {streak.current} {streak.current === 1 ? "día" : "días"} de racha
                </p>
                <p className="mt-0.5 text-[11px] text-orange-600/80">
                  Récord: {streak.longest} {streak.longest === 1 ? "día" : "días"}. ¡Sigue así!
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  🔥 Racha
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Completa una lección o quiz para empezarla.
                </p>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400">
              Aún no tienes conversaciones. ¡Empieza una nueva!
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => void selectConversation(conv.id)}
                    className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                      conv.id === currentId
                        ? "bg-emerald-100 font-medium text-emerald-800"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title={conv.title ?? "Nueva conversación"}
                  >
                    {conv.title ?? "Nueva conversación"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Selector de nivel de conocimiento financiero */}
        <div className="border-t border-slate-200 p-3">
          <label
            htmlFor="financial-level"
            className="mb-1 block px-1 text-xs font-medium text-slate-500"
          >
            Nivel de conocimiento
            {savingLevel && <span className="text-slate-400"> · guardando…</span>}
          </label>
          <select
            id="financial-level"
            value={level ?? ""}
            disabled={savingLevel}
            onChange={(e) => {
              const value = e.target.value;
              if (value) void changeLevel(value as FinancialLevel);
            }}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
          >
            <option value="" disabled>
              Selecciona tu nivel…
            </option>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
          <p className="mt-1 px-1 text-[11px] leading-snug text-slate-400">
            El tutor adapta sus explicaciones a tu nivel.
          </p>
        </div>

        {/* Usuario + cerrar sesión */}
        <div className="border-t border-slate-200 p-3">
          <p className="mb-2 truncate px-1 text-xs text-slate-500" title={userEmail}>
            {userEmail}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Área principal de chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex-none rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Abrir conversaciones"
              >
                {/* Icono hamburguesa */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                Tutor de Educación Financiera
              </h1>
            </div>
            <div className="flex flex-none items-center gap-2">
              {/* CTA a la suscripción: el punto de entrada al plan desde el chat.
                  Con membresía activa se cambia por un distintivo, igual que en
                  la cabecera de la ruta de aprendizaje. */}
              {isPremium ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
                  title="Membresía Premium activa"
                >
                  👑 Premium
                </span>
              ) : (
                <Link
                  href="/pricing"
                  title="Ver los planes y hacerte Premium"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-amber-300 sm:px-3.5 sm:text-sm"
                >
                  <span aria-hidden="true">⚡</span>
                  <span className="sm:hidden">Premium</span>
                  <span className="hidden sm:inline">Hacerse Premium</span>
                </Link>
              )}
              {streak.current > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700"
                  title={`Racha de ${streak.current} ${
                    streak.current === 1 ? "día" : "días"
                  } · récord: ${streak.longest}`}
                >
                  🔥 {streak.current}
                </span>
              )}
              {level && (
                <span className="hidden items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 sm:inline-flex">
                  Nivel: {LEVEL_LABELS[level]}
                </span>
              )}
              <span className="hidden w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 sm:inline-flex">
                Contenido educativo · No es asesoría
              </span>
            </div>
          </div>
        </header>

        {/* Historial */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLastAssistant =
                !isUser &&
                index === messages.length - 1 &&
                isLoading &&
                message.content === "";

              return (
                <div
                  key={index}
                  className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-100 text-base">
                      🎓
                    </span>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      isUser
                        ? "rounded-br-sm bg-slate-900 text-white"
                        : "rounded-bl-sm bg-white text-slate-800"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    ) : isLastAssistant ? (
                      <TypingIndicator />
                    ) : (
                      <MarkdownMessage content={message.content} />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* Barra de entrada */}
        <footer className="border-t border-slate-200 bg-white">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Haz una pregunta sobre finanzas o pide un concepto..."
                disabled={isLoading}
                className="max-h-40 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || input.trim() === ""}
                className="flex-none rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Generando…" : "Enviar"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              Pulsa Enter para enviar · Shift + Enter para nueva línea
            </p>
          </form>
        </footer>
      </div>
    </div>
  );
}
