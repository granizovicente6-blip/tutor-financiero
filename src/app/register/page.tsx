"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { register } from "./actions";
import type { AuthState } from "@/lib/types";

const initialState: AuthState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creando cuenta…" : "Crear cuenta"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
            📊
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Crea tu cuenta</h1>
          <p className="text-sm text-slate-500">Empieza a aprender finanzas con tu tutor personal.</p>
        </div>

        <form
          action={formAction}
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

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
          )}
          {state.message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {state.message}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
