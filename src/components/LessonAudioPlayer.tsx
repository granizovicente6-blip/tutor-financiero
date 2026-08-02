"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  buildNarration,
  estimateSeconds,
  formatClock,
  narrationLength,
} from "@/lib/lesson-audio";
import {
  FREE_PREVIEW_SECONDS,
  PLAYBACK_RATES,
  lessonSpeech,
  type PlaybackRate,
  type SpeechStatus,
} from "@/lib/speech";

// =============================================================================
// Modo Podcast — reproductor de la lección (Fase 9)
//
// El componente NO guarda el audio: es el mando a distancia de `lib/speech`,
// un reproductor que vive fuera de React. Por eso se puede re-renderizar,
// desplazar o incluso desmontar sin que la narración se corte.
//
// Muro de pago: sin membresía se reproducen 30 segundos y aparece la
// invitación a suscribirse. Es una barrera COMERCIAL, no de seguridad — el
// texto de la lección ya está en pantalla y el usuario tiene derecho a leerlo;
// lo que se vende aquí es la comodidad de escucharla entera.
// =============================================================================

interface LessonAudioPlayerProps {
  lessonSlug: string;
  title: string;
  summary: string;
  /** Contenido de la lección en Markdown (se convierte a guion hablado). */
  content: string;
  /** True si la membresía está activa (abre la narración completa). */
  isPremium: boolean;
  /** Precio ya formateado ("$4.990"): el formato lo decide el servidor. */
  priceLabel: string;
  /** Moneda del plan ("CLP"), tal como la publica `lib/subscription`. */
  currencyLabel: string;
}

export function LessonAudioPlayer({
  lessonSlug,
  title,
  summary,
  content,
  isPremium,
  priceLabel,
  currencyLabel,
}: LessonAudioPlayerProps) {
  // El guion se calcula una vez por lección: es una transformación pura y cara.
  const chunks = useMemo(
    () => buildNarration({ title, summary, content }),
    [title, summary, content],
  );

  const state = useSyncExternalStore(
    lessonSpeech.subscribe,
    lessonSpeech.getSnapshot,
    lessonSpeech.getServerSnapshot,
  );

  useEffect(() => {
    lessonSpeech.load(lessonSlug, chunks, isPremium ? null : FREE_PREVIEW_SECONDS * 1000);
  }, [lessonSlug, chunks, isPremium]);

  const [showPaywall, setShowPaywall] = useState(false);
  /** Evita reabrir el muro en cada render una vez que el usuario lo cerró. */
  const paywallShown = useRef(false);

  useEffect(() => {
    if (state.limitReached && !paywallShown.current) {
      paywallShown.current = true;
      setShowPaywall(true);
    }
    if (!state.limitReached) paywallShown.current = false;
  }, [state.limitReached]);

  // Cerrar el muro con Escape.
  useEffect(() => {
    if (!showPaywall) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPaywall(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPaywall]);

  // La tarjeta se pierde de vista al bajar por la lección; entonces aparece el
  // mini-reproductor fijo para no dejar al usuario sin controles a mitad de
  // escucha (que es cuando más los necesita).
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardVisible, setCardVisible] = useState(true);

  useEffect(() => {
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCardVisible(entry?.isIntersecting ?? true),
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Antes de que corra el efecto de carga, el reproductor aún no conoce esta
  // lección: los totales se calculan en local para que no haya parpadeo.
  const isActive = state.lessonSlug === lessonSlug;
  const totalChars = isActive ? state.totalChars : narrationLength(chunks);
  const spokenChars = isActive ? state.spokenChars : 0;
  const status: SpeechStatus = isActive ? state.status : "idle";
  const rate = state.rate;

  const progress = totalChars > 0 ? Math.min(1, spokenChars / totalChars) : 0;
  const totalSeconds = estimateSeconds(totalChars, rate);
  const positionSeconds = estimateSeconds(spokenChars, rate);
  const previewLeft =
    state.previewRemainingMs === null ? null : Math.ceil(state.previewRemainingMs / 1000);

  const unsupported = state.unsupported;

  function handleToggle(): void {
    // Agotada la vista previa, el play deja de reproducir y pasa a vender.
    if (!isPremium && state.limitReached) {
      setShowPaywall(true);
      return;
    }
    lessonSpeech.toggle();
  }

  const transport = (
    <Transport
      status={status}
      progress={progress}
      positionLabel={formatClock(positionSeconds)}
      totalLabel={formatClock(totalSeconds)}
      rate={rate}
      disabled={unsupported || chunks.length === 0}
      onToggle={handleToggle}
      onRestart={() => lessonSpeech.stop()}
      onSeek={(fraction) => lessonSpeech.seek(fraction)}
      onRate={(next) => lessonSpeech.setRate(next)}
    />
  );

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Tarjeta principal, al inicio de la lección                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        ref={cardRef}
        aria-label="Escuchar la lección como podcast"
        className="mt-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-indigo-100 text-lg"
            aria-hidden="true"
          >
            🎧
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-indigo-950">
              Escuchar como Podcast <span aria-hidden="true">🎧</span>
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {unsupported
                ? "Tu navegador no permite la narración por voz. Prueba con Chrome, Edge o Safari."
                : isPremium
                  ? `Narración completa de la lección · ${formatClock(totalSeconds)} de audio.`
                  : `Escucha una vista previa de ${FREE_PREVIEW_SECONDS} s. Con la Membresía Premium la lección completa (${formatClock(totalSeconds)}).`}
            </p>
          </div>
          {!isPremium && (
            <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              👑 Premium
            </span>
          )}
        </div>

        {!unsupported && <div className="mt-4">{transport}</div>}

        {/* Selector de relator. El catálogo lo pone el sistema operativo, así
            que aquí solo se ofrece lo que este dispositivo tenga instalado.
            Mientras el navegador no lo haya entregado no se afirma nada. */}
        {!unsupported && state.voicesReady && (
          <div className="mt-3 flex items-center gap-2">
            <label
              htmlFor="lesson-voice"
              className="flex-none text-[11px] font-medium text-slate-500"
            >
              <span aria-hidden="true">🎙️</span> Relator
            </label>
            {state.voices.length > 0 ? (
              <select
                id="lesson-voice"
                value={state.voiceId ?? ""}
                onChange={(event) => lessonSpeech.setVoice(event.target.value)}
                className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {state.voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 flex-1 text-[11px] text-slate-500">
                Tu dispositivo no tiene voces en español instaladas; se usará la
                predeterminada del navegador.
              </span>
            )}
          </div>
        )}

        {!unsupported && state.voicesReady && state.voices.length === 1 && (
          <p className="mt-1 text-[11px] text-slate-400">
            Este dispositivo ofrece un solo relator en español. Instalar más voces
            del sistema añade opciones aquí.
          </p>
        )}

        {!isPremium && !unsupported && (
          <p className="mt-3 text-[11px] text-slate-500">
            {previewLeft !== null && previewLeft > 0 && status !== "idle"
              ? `Vista previa: quedan ${previewLeft} s de audio.`
              : state.limitReached
                ? "Vista previa terminada. Suscríbete para escuchar la lección completa."
                : `Vista previa gratuita de ${FREE_PREVIEW_SECONDS} segundos.`}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Mini-reproductor fijo mientras la tarjeta está fuera de pantalla    */}
      {/* ------------------------------------------------------------------ */}
      {!cardVisible && status !== "idle" && !unsupported && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-indigo-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="hidden flex-none text-lg sm:block" aria-hidden="true">
              🎧
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-slate-500">{title}</p>
              <div className="mt-1">{transport}</div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Muro de pago: la vista previa gratuita se agotó                     */}
      {/* ------------------------------------------------------------------ */}
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          onClick={() => setShowPaywall(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-paywall-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-6 text-center shadow-xl sm:rounded-2xl"
          >
            <span className="text-3xl" aria-hidden="true">
              🎧
            </span>
            <h2 id="audio-paywall-title" className="mt-2 text-lg font-bold text-slate-900">
              Se acabó la vista previa
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Escuchaste los primeros {FREE_PREVIEW_SECONDS} segundos de «{title}». Con la
              Membresía Premium escuchas esta lección completa y las 86 del programa
              mientras caminas, cocinas o vas al trabajo.
            </p>

            <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-2 text-left">
              {[
                { icon: "🎧", text: "Todas las lecciones en audio, sin límite de tiempo." },
                { icon: "📚", text: "Las 86 lecciones del programa completo." },
                { icon: "🎓", text: "Tutor de IA sin límites y análisis de mercado." },
              ].map((benefit) => (
                <li key={benefit.icon} className="flex items-start gap-2">
                  <span className="flex-none text-base" aria-hidden="true">
                    {benefit.icon}
                  </span>
                  <span className="text-xs text-slate-600">{benefit.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p>
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {priceLabel}
                </span>
                <span className="ml-1 text-xs font-medium text-slate-500">
                  {currencyLabel} / mes
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">Cancela cuando quieras.</p>
            </div>

            <Link
              href="/pricing"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Suscribirme por {priceLabel} {currencyLabel}/mes{" "}
              <span aria-hidden="true">→</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowPaywall(false)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Seguir leyendo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Controles (los comparten la tarjeta y el mini-reproductor)
// ---------------------------------------------------------------------------

interface TransportProps {
  status: SpeechStatus;
  /** Avance de 0 a 1. */
  progress: number;
  positionLabel: string;
  totalLabel: string;
  rate: PlaybackRate;
  disabled: boolean;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (fraction: number) => void;
  onRate: (rate: PlaybackRate) => void;
}

function Transport({
  status,
  progress,
  positionLabel,
  totalLabel,
  rate,
  disabled,
  onToggle,
  onRestart,
  onSeek,
  onRate,
}: TransportProps) {
  const isPlaying = status === "playing";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isPlaying ? "Pausar la narración" : "Reproducir la narración"}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {isPlaying ? "❚❚" : "▶"}
        </span>
      </button>

      <button
        type="button"
        onClick={onRestart}
        disabled={disabled || status === "idle"}
        aria-label="Volver al principio"
        title="Volver al principio"
        className="hidden h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
      >
        <span aria-hidden="true">↺</span>
      </button>

      <div className="min-w-0 flex-1">
        <ProgressBar
          progress={progress}
          disabled={disabled}
          label={`${positionLabel} de ${totalLabel}`}
          onSeek={onSeek}
        />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
          <span>{positionLabel}</span>
          <span>{totalLabel}</span>
        </div>
      </div>

      <div
        role="group"
        aria-label="Velocidad de reproducción"
        className="flex flex-none items-center gap-0.5 rounded-full bg-slate-100 p-0.5"
      >
        {PLAYBACK_RATES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRate(option)}
            disabled={disabled}
            aria-pressed={option === rate}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              option === rate
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  label: string;
  disabled: boolean;
  onSeek: (fraction: number) => void;
}

function ProgressBar({ progress, label, disabled, onSeek }: ProgressBarProps) {
  const percent = Math.round(progress * 1000) / 10;

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Posición de la narración"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={label}
      aria-disabled={disabled}
      onPointerDown={(event) => {
        if (disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0) return;
        onSeek((event.clientX - rect.left) / rect.width);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onSeek(progress + 0.05);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onSeek(progress - 0.05);
        } else if (event.key === "Home") {
          event.preventDefault();
          onSeek(0);
        }
      }}
      className={`relative h-2 w-full rounded-full bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-indigo-600 transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-indigo-600 transition-[left] duration-200"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}
