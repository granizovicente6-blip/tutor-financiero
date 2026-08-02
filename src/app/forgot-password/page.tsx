import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

/**
 * Página "Olvidé mi contraseña" (paso 1 de 2): se pide el correo y Supabase
 * envía el enlace que lleva a `/reset-password`, donde se fija la nueva clave.
 *
 * Es pública y no comprueba la sesión: un usuario con sesión abierta también
 * puede querer restablecer su contraseña desde aquí.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
              📊
            </span>
            <h1 className="text-xl font-semibold text-slate-900">Recupera tu contraseña</h1>
          </Link>
          <p className="text-sm text-slate-500">
            Escribe tu correo y te enviamos un enlace para crear una nueva.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
