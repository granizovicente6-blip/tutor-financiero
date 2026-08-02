"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginPath, resetPasswordRedirectUrl } from "@/lib/auth-redirect";

/**
 * Formulario "¿Olvidaste tu contraseña?" — pide el correo y dispara el envío.
 *
 * Va en el CLIENTE (y no en una Server Action) a propósito: `resetPasswordForEmail`
 * genera un `code_verifier` de PKCE que el navegador guarda y que solo él puede
 * canjear después en `/reset-password`. Si el correo se pidiera desde el servidor,
 * el verificador quedaría en el sitio equivocado y el enlace no abriría sesión.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const address = email.trim();
    if (!address) {
      setError("Introduce tu correo electrónico.");
      return;
    }

    setSending(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: resetPasswordRedirectUrl(),
    });

    setSending(false);

    if (resetError) {
      // El caso típico aquí es el límite de envíos de Supabase; los correos que
      // no existen NO dan error (no se revela quién tiene cuenta).
      setError("No pudimos enviar el correo. Espera un momento e inténtalo de nuevo.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Te hemos enviado un correo con instrucciones para restablecer tu contraseña.
        </p>
        <p className="text-xs text-slate-500">
          Revisa la bandeja de entrada de <span className="font-medium">{email.trim()}</span> (y la
          carpeta de spam). El enlace caduca en una hora.
        </p>
        <Link
          href={loginPath()}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Enviando…" : "Enviar instrucciones"}
      </button>

      <p className="text-center text-sm text-slate-500">
        ¿Ya la recordaste?{" "}
        <Link href={loginPath()} className="font-medium text-emerald-700 hover:text-emerald-800">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
