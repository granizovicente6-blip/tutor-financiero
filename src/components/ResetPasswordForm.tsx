"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FORGOT_PASSWORD_PATH, loginPath } from "@/lib/auth-redirect";

/** Longitud mínima de contraseña; la misma que exige el registro. */
const MIN_PASSWORD_LENGTH = 6;

/** Segundos que se deja el mensaje de éxito en pantalla antes de ir al login. */
const REDIRECT_DELAY_MS = 2500;

type Status =
  /** Comprobando si el enlace del correo trajo una sesión de recuperación. */
  | "checking"
  /** Hay sesión: se puede fijar la nueva contraseña. */
  | "ready"
  /** El enlace no es válido, ya se usó o caducó. */
  | "invalid"
  /** Contraseña cambiada; redirigiendo al login. */
  | "done";

const INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

/**
 * Lee un error devuelto por Supabase en la propia URL.
 *
 * Cuando el enlace del correo ya no sirve (caducado o usado), Supabase no manda
 * ningún token: redirige aquí con `error`/`error_description`, y según el flujo
 * los pone en el fragmento (`#`) o en la query (`?`).
 */
function hasUrlError(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return Boolean(hash.get("error") ?? query.get("error"));
}

/**
 * Formulario de nueva contraseña (paso 2 de 2 del flujo de recuperación).
 *
 * Al abrir el enlace del correo, el cliente de Supabase del navegador canjea
 * automáticamente el código de la URL por una sesión de recuperación
 * (`detectSessionInUrl`), y es esa sesión la que autoriza el `updateUser`. Por
 * eso el componente primero espera y comprueba que exista sesión: sin ella el
 * formulario no sirve de nada y es mejor decirlo que fallar al enviar.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasUrlError()) {
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    let active = true;

    // `getSession()` no resuelve hasta que el cliente ha terminado de mirar la
    // URL, así que aquí ya sabemos si el canje del enlace funcionó.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setStatus((current) => (current === "done" ? current : session ? "ready" : "invalid"));
    });

    // Red de seguridad por si el evento de recuperación llega algo más tarde.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setStatus((current) => (current === "done" ? current : "ready"));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSaving(false);
      setError(
        updateError.message.toLowerCase().includes("different")
          ? "La nueva contraseña debe ser distinta de la anterior."
          : "No pudimos cambiar la contraseña. Vuelve a pedir el enlace e inténtalo de nuevo.",
      );
      return;
    }

    setSaving(false);
    setStatus("done");

    // Se cierra la sesión de recuperación a propósito: así el usuario estrena la
    // contraseña nueva en el login (que es a donde lo llevamos) en vez de quedar
    // dentro con una sesión que nació de un enlace del correo.
    await supabase.auth.signOut();

    redirectTimer.current = setTimeout(() => {
      router.replace(loginPath());
      router.refresh();
    }, REDIRECT_DELAY_MS);
  }

  if (status === "checking") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        Validando el enlace…
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Este enlace ya no es válido: puede haber caducado o haberse usado antes.
        </p>
        <p className="text-xs text-slate-500">
          Pide uno nuevo y ábrelo en el mismo navegador desde el que lo solicitaste.
        </p>
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ¡Listo! Tu contraseña se cambió correctamente.
        </p>
        <p className="text-xs text-slate-500">
          Te llevamos al inicio de sesión para que entres con la nueva…
        </p>
        <Link
          href={loginPath()}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Ir al inicio de sesión
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
        <span className="font-medium text-slate-700">Nueva contraseña</span>
        <input
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Confirma la nueva contraseña</span>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
