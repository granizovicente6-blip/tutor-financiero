"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { register } from "@/app/register/actions";
import { loginPath, REDIRECT_PARAM } from "@/lib/auth-redirect";
import type { AuthState } from "@/lib/types";

const initialState: AuthState = { error: null, message: null };

interface RegisterFormProps {
  /** Ruta interna a la que ir tras crear la cuenta (ya saneada en el server). */
  redirectTo: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creando cuenta…" : "Crear cuenta gratis"}
    </button>
  );
}

export function RegisterForm({ redirectTo }: RegisterFormProps) {
  const [state, formAction] = useFormState(register, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* Mismo destino que traía el login: la Server Action lo vuelve a sanear. */}
      <input type="hidden" name={REDIRECT_PARAM} value={redirectTo} />

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
          minLength={6}
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </label>

      {/* role="alert" para que el lector de pantalla lo anuncie al volver la
          Server Action: el mensaje aparece lejos del foco (que sigue en el
          botón). `break-words` es por el motivo original de Supabase, que
          cuando no hay traducción viene largo y sin espacios. */}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 break-words"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 break-words"
        >
          {state.message}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={loginPath(redirectTo)}
          className="font-medium text-emerald-700 hover:text-emerald-800"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
