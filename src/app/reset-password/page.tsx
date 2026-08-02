import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

/**
 * Página de nueva contraseña (paso 2 de 2): es el destino del enlace que
 * Supabase manda por correo desde `/forgot-password`.
 *
 * Toda la lógica vive en el componente cliente porque el token de recuperación
 * viaja en la URL y lo canjea el navegador; el servidor aquí solo pinta el marco.
 */
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
              📊
            </span>
            <h1 className="text-xl font-semibold text-slate-900">Nueva contraseña</h1>
          </Link>
          <p className="text-sm text-slate-500">
            Elige una contraseña nueva para tu cuenta y confírmala.
          </p>
        </div>

        <ResetPasswordForm />

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
