// =============================================================================
// Motor de narración — Modo Podcast (Fase 9)
//
// Envuelve la Web Speech API (`window.speechSynthesis`) en un reproductor con
// play/pausa, velocidad, progreso y salto de posición.
//
// Decisión clave: el motor es un SINGLETON de módulo, NO estado de React.
//
//   La síntesis de voz vive en el navegador, fuera del árbol de React. Si el
//   estado viviera en un componente, cualquier re-render por scroll, cualquier
//   `router.refresh()` al completar la lección o un desmontaje momentáneo del
//   componente cortaría la narración a mitad de frase. Aquí el audio sobrevive
//   a todo eso: los componentes se suscriben con `useSyncExternalStore` y son
//   meros mandos a distancia de un reproductor que ya está sonando.
//
// La reproducción va fragmento a fragmento (ver `lib/lesson-audio`), lo que da
// progreso real y permite cambiar de velocidad o saltar sin recargar nada.
// =============================================================================

/** Estado del reproductor. `paused` conserva la posición; `idle` no suena nada. */
export type SpeechStatus = "idle" | "playing" | "paused";

/** Velocidades ofrecidas en la interfaz. */
export const PLAYBACK_RATES = [1, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Duración de la vista previa gratuita, en segundos de audio realmente oídos. */
export const FREE_PREVIEW_SECONDS = 30;

/** Fotografía del reproductor que consume la interfaz. */
export interface SpeechSnapshot {
  status: SpeechStatus;
  /** Lección cargada ahora mismo (null si ninguna). */
  lessonSlug: string | null;
  /** Caracteres del guion ya narrados (numerador de la barra de progreso). */
  spokenChars: number;
  totalChars: number;
  rate: PlaybackRate;
  /** True cuando la vista previa gratuita se agotó (dispara el muro de pago). */
  limitReached: boolean;
  /** Milisegundos de vista previa que quedan; null si no hay límite (Premium). */
  previewRemainingMs: number | null;
  /** El navegador no ofrece síntesis de voz. */
  unsupported: boolean;
}

const IDLE_SNAPSHOT: SpeechSnapshot = {
  status: "idle",
  lessonSlug: null,
  spokenChars: 0,
  totalChars: 0,
  rate: 1,
  limitReached: false,
  previewRemainingMs: null,
  unsupported: false,
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Retrocede hasta el principio de la palabra que contiene `index`.
 *
 * Al reanudar tras una pausa se reparte desde ahí: cortar a media palabra
 * suena a error, repetir la palabra entera suena a reproductor.
 */
function wordStart(text: string, index: number): number {
  let cursor = Math.max(0, Math.min(index, text.length));
  while (cursor > 0 && !/\s/.test(text[cursor - 1] ?? "")) cursor -= 1;
  return cursor;
}

/**
 * Elige la mejor voz en español disponible.
 *
 * Prioriza el español de Chile y el latinoamericano (nuestra audiencia) y
 * premia las voces neuronales/de red, que son las que suenan fluidas. El
 * catálogo depende del sistema operativo, así que siempre hay plan B.
 */
function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  if (spanish.length === 0) return null;

  const REGIONS = ["es-cl", "es-419", "es-mx", "es-us", "es-ar", "es-co", "es-pe", "es-es"];

  let best = spanish[0];
  let bestScore = -1;
  for (const voice of spanish) {
    const tag = voice.lang.toLowerCase().replace("_", "-");
    const region = REGIONS.indexOf(tag);
    let score = region === -1 ? 0 : (REGIONS.length - region) * 2;
    if (/google|natural|neural|premium|enhanced|online/i.test(voice.name)) score += 6;
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// El reproductor
// ---------------------------------------------------------------------------

class LessonSpeechEngine {
  private listeners = new Set<() => void>();
  private snapshot: SpeechSnapshot = IDLE_SNAPSHOT;

  // Guion cargado
  private chunks: string[] = [];
  /** Offset acumulado de cada fragmento dentro del guion completo. */
  private offsets: number[] = [];
  private totalChars = 0;
  private lessonSlug: string | null = null;

  // Posición
  private index = 0;
  /** Caracteres narrados dentro del fragmento actual. */
  private charInChunk = 0;
  /** Offset del fragmento en el que arrancó la locución en curso. */
  private uttStart = 0;

  private status: SpeechStatus = "idle";
  private rate: PlaybackRate = 1;

  private current: SpeechSynthesisUtterance | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private voiceListenerBound = false;
  private unloadBound = false;

  // Vista previa gratuita
  private limitMs: number | null = null;
  private playedMs = 0;
  private limitReached = false;

  private ticker: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private pendingSpeak: ReturnType<typeof setTimeout> | null = null;
  private stalledTicks = 0;

  // -------------------------------------------------------------------------
  // Suscripción (useSyncExternalStore). Métodos flecha: se pasan por referencia.
  // -------------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SpeechSnapshot => this.snapshot;

  /** En el servidor no hay audio: el reproductor se pinta siempre en reposo. */
  getServerSnapshot = (): SpeechSnapshot => IDLE_SNAPSHOT;

  // -------------------------------------------------------------------------
  // Carga
  // -------------------------------------------------------------------------

  /**
   * Prepara (o reutiliza) el guion de una lección.
   *
   * Si es la MISMA lección que ya está cargada no se reinicia nada: es lo que
   * permite que un re-render del componente no interrumpa lo que está sonando.
   *
   * @param limitMs tope de la vista previa en ms, o `null` para acceso completo.
   */
  load(lessonSlug: string, chunks: string[], limitMs: number | null): void {
    if (this.lessonSlug === lessonSlug && this.chunks.length === chunks.length) {
      if (this.limitMs !== limitMs) {
        this.limitMs = limitMs;
        // Al activarse la membresía desaparece el muro sin recargar el guion.
        if (limitMs === null) this.limitReached = false;
        this.publish();
      }
      return;
    }

    this.hardStop();
    this.lessonSlug = lessonSlug;
    this.chunks = chunks;

    this.offsets = [];
    let accumulated = 0;
    for (const chunk of chunks) {
      this.offsets.push(accumulated);
      accumulated += chunk.length + 1;
    }
    this.totalChars = Math.max(1, accumulated);

    this.index = 0;
    this.charInChunk = 0;
    this.uttStart = 0;
    this.limitMs = limitMs;
    this.playedMs = 0;
    this.limitReached = false;

    this.ensureVoice();
    this.bindUnload();
    this.publish();
  }

  // -------------------------------------------------------------------------
  // Transporte
  // -------------------------------------------------------------------------

  play(): void {
    if (!this.supported() || this.chunks.length === 0) {
      this.publish();
      return;
    }
    if (this.status === "playing") return;
    if (this.previewExhausted()) return; // el muro de pago lo gestiona la UI

    // Terminada la lección, volver a darle al play la reinicia.
    if (this.index >= this.chunks.length) {
      this.index = 0;
      this.charInChunk = 0;
      this.uttStart = 0;
    }

    this.status = "playing";
    this.startTicker();
    // Tras un `cancel()` previo, Chrome se queda mudo si `speak()` va en el
    // mismo tick: un respiro mínimo hace que arranque siempre.
    this.scheduleSpeak(60);
    this.publish();
  }

  /**
   * Pausa CANCELANDO la locución y recordando la posición, en vez de usar
   * `speechSynthesis.pause()`: la pausa nativa no funciona en varios motores
   * (Chrome en Android, entre otros) y dejaba el reproductor colgado. Al
   * reanudar se reparte desde el inicio de la palabra en curso, así que la
   * costura es inaudible.
   */
  pause(): void {
    if (this.status !== "playing") return;
    this.silence();
    this.stopTicker();
    this.status = "paused";
    this.publish();
  }

  toggle(): void {
    if (this.status === "playing") this.pause();
    else this.play();
  }

  /** Detiene y vuelve al principio de la lección. */
  stop(): void {
    this.hardStop();
    this.index = 0;
    this.charInChunk = 0;
    this.uttStart = 0;
    this.publish();
  }

  setRate(rate: PlaybackRate): void {
    if (rate === this.rate) return;
    this.rate = rate;
    // `rate` no se puede cambiar en una locución ya lanzada: se relanza el
    // fragmento actual desde donde iba, con la nueva velocidad.
    if (this.status === "playing") this.restartCurrent();
    else this.publish();
  }

  /** Salta a una posición del guion (0 = principio, 1 = final). */
  seek(fraction: number): void {
    if (this.chunks.length === 0) return;

    const target = Math.max(0, Math.min(1, fraction)) * this.totalChars;
    let index = 0;
    while (index + 1 < this.offsets.length && (this.offsets[index + 1] ?? 0) <= target) {
      index += 1;
    }

    this.index = index;
    this.charInChunk = 0;
    this.uttStart = 0;

    if (this.status === "playing") {
      this.restartCurrent();
      return;
    }
    // En pausa hay una locución cancelada a medias: se descarta para que el
    // siguiente play arranque limpio en la nueva posición.
    this.silence();
    this.publish();
  }

  // -------------------------------------------------------------------------
  // Síntesis
  // -------------------------------------------------------------------------

  private speakCurrent(): void {
    const synth = this.synth();
    if (!synth) return;

    const text = this.chunks[this.index];
    if (text === undefined) {
      this.finish();
      return;
    }

    this.uttStart = wordStart(text, this.charInChunk);
    this.charInChunk = this.uttStart;

    const utterance = new SpeechSynthesisUtterance(text.slice(this.uttStart));
    if (this.voice) utterance.voice = this.voice;
    utterance.lang = this.voice?.lang ?? "es-CL";
    utterance.rate = this.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    // `current` identifica la locución viva: cualquier evento de una locución
    // ya sustituida (por pausa, salto o cambio de velocidad) se descarta.
    utterance.onboundary = (event) => {
      if (this.current !== utterance) return;
      this.charInChunk = Math.min(this.uttStart + event.charIndex, text.length);
      this.publish();
    };

    utterance.onend = () => {
      if (this.current !== utterance) return;
      this.current = null;
      this.index += 1;
      this.charInChunk = 0;
      this.uttStart = 0;
      if (this.index >= this.chunks.length) {
        this.finish();
        return;
      }
      this.speakCurrent(); // encadena sin hueco audible
      this.publish();
    };

    utterance.onerror = (event) => {
      if (this.current !== utterance) return;
      this.current = null;
      // Cancelar es la vía normal de pausa/salto, no un fallo que reportar.
      if (event.error === "interrupted" || event.error === "canceled") return;
      console.error("[podcast] La síntesis de voz falló:", event.error);
      this.stopTicker();
      this.status = "paused";
      this.publish();
    };

    this.current = utterance;
    this.stalledTicks = 0;
    synth.speak(utterance);
  }

  /** Relanza el fragmento actual desde su posición (cambio de velocidad/salto). */
  private restartCurrent(): void {
    this.silence();
    this.scheduleSpeak(80);
    this.publish();
  }

  private scheduleSpeak(delayMs: number): void {
    this.clearPendingSpeak();
    this.pendingSpeak = setTimeout(() => {
      this.pendingSpeak = null;
      if (this.status !== "playing") return;
      this.speakCurrent();
    }, delayMs);
  }

  private clearPendingSpeak(): void {
    if (this.pendingSpeak !== null) {
      clearTimeout(this.pendingSpeak);
      this.pendingSpeak = null;
    }
  }

  /** Corta lo que suene conservando la posición y el estado. */
  private silence(): void {
    this.clearPendingSpeak();
    this.current = null;
    this.synth()?.cancel();
  }

  private hardStop(): void {
    this.silence();
    this.stopTicker();
    this.status = "idle";
  }

  private finish(): void {
    this.silence();
    this.stopTicker();
    this.status = "idle";
    this.index = this.chunks.length;
    this.charInChunk = 0;
    this.uttStart = 0;
    this.publish();
  }

  // -------------------------------------------------------------------------
  // Reloj: mide lo realmente oído (vista previa) y vigila que la voz siga viva
  // -------------------------------------------------------------------------

  private startTicker(): void {
    this.stopTicker();
    this.lastTickAt = Date.now();
    this.stalledTicks = 0;
    this.ticker = setInterval(() => this.onTick(), 250);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private onTick(): void {
    const now = Date.now();
    this.playedMs += now - this.lastTickAt;
    this.lastTickAt = now;

    if (this.limitMs !== null && this.playedMs >= this.limitMs) {
      this.reachLimit();
      return;
    }

    // Algunos motores dejan de hablar en silencio, sin `end` ni `error`. Si
    // llevamos ~1 s sin nada en cola con el reproductor en marcha, se relanza.
    const synth = this.synth();
    if (synth && this.current !== null && this.pendingSpeak === null) {
      if (!synth.speaking && !synth.pending) {
        this.stalledTicks += 1;
        if (this.stalledTicks >= 4) {
          this.stalledTicks = 0;
          this.restartCurrent();
          return;
        }
      } else {
        this.stalledTicks = 0;
      }
    }

    this.publish();
  }

  /** Se agotó la vista previa: se detiene y se avisa a la UI (muro de pago). */
  private reachLimit(): void {
    this.silence();
    this.stopTicker();
    // "paused" y no "idle": la barra se queda donde se cortó, que es
    // justamente lo que hace tangible lo que el usuario se está perdiendo.
    this.status = "paused";
    this.limitReached = true;
    this.publish();
  }

  private previewExhausted(): boolean {
    return this.limitMs !== null && this.playedMs >= this.limitMs;
  }

  // -------------------------------------------------------------------------
  // Entorno
  // -------------------------------------------------------------------------

  private synth(): SpeechSynthesis | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    return window.speechSynthesis;
  }

  private supported(): boolean {
    return this.synth() !== null && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /** El catálogo de voces se puebla de forma asíncrona en varios navegadores. */
  private ensureVoice(): void {
    const synth = this.synth();
    if (!synth) return;

    const apply = () => {
      const picked = pickSpanishVoice(synth.getVoices());
      if (picked) this.voice = picked;
    };

    apply();
    if (!this.voiceListenerBound) {
      this.voiceListenerBound = true;
      synth.addEventListener("voiceschanged", apply);
    }
  }

  /**
   * La síntesis sobrevive a la navegación: sin esto la lección seguiría
   * narrándose después de cerrar o cambiar de página.
   */
  private bindUnload(): void {
    if (this.unloadBound || typeof window === "undefined") return;
    this.unloadBound = true;
    window.addEventListener("pagehide", () => this.hardStop());
  }

  // -------------------------------------------------------------------------
  // Publicación del estado
  // -------------------------------------------------------------------------

  private spokenChars(): number {
    if (this.chunks.length === 0) return 0;
    if (this.index >= this.chunks.length) return this.totalChars;
    return Math.min(this.totalChars, (this.offsets[this.index] ?? 0) + this.charInChunk);
  }

  private publish(): void {
    this.snapshot = {
      status: this.status,
      lessonSlug: this.lessonSlug,
      spokenChars: this.spokenChars(),
      totalChars: this.totalChars,
      rate: this.rate,
      limitReached: this.limitReached,
      previewRemainingMs:
        this.limitMs === null ? null : Math.max(0, this.limitMs - this.playedMs),
      unsupported: !this.supported(),
    };
    for (const listener of this.listeners) listener();
  }
}

/**
 * Instancia única del reproductor. Vive en el módulo, no en React: por eso la
 * narración no se corta al re-renderizar, al hacer scroll ni al refrescar el
 * progreso de la lección.
 */
export const lessonSpeech = new LessonSpeechEngine();
