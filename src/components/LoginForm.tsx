"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/app/login/actions";
import { REDIRECT_PARAM, registerPath } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

const initialState: AuthState = { error: null, message: null };

interface LoginFormProps {
  /** Ruta interna a la que volver tras autenticarse (ya saneada en el server). */
  redirectTo: string;
  /** Mensaje de contexto cuando llega rebotado desde una ruta protegida. */
  notice: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Entrando…" : "Iniciar sesión"}
    </button>
  );
}

export function LoginForm({ redirectTo, notice }: LoginFormProps) {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* El destino viaja con el formulario: la Server Action lo vuelve a
          sanear antes de redirigir (el valor original venía de la URL). */}
      <input type="hidden" name={REDIRECT_PARAM} value={redirectTo} />

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link
          href={registerPath(redirectTo)}
          className="font-medium text-emerald-700 hover:text-emerald-800"
        >
          Regístrate gratis
        </Link>
      </p>
    </form>
  );
}
