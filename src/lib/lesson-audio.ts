// =============================================================================
// Guion de narración — Markdown de la lección → fragmentos hablables (Fase 9)
//
// El contenido del currículum está en Markdown y pensado para LEERSE. Para
// escucharlo hay que traducirlo: quitar la sintaxis (que la voz leería como
// "asterisco asterisco"), quitar los emojis y partirlo en fragmentos cortos.
//
// Por qué fragmentos y no una sola locución gigante: la Web Speech API es
// frágil con textos largos (varios navegadores cortan la síntesis pasados unos
// segundos) y no expone ningún control de posición. Narrando fragmento a
// fragmento obtenemos gratis lo que necesita un reproductor: progreso real,
// cambio de velocidad en caliente y salto a cualquier punto de la lección.
//
// Es una transformación PURA y sin estado: se puede calcular en el cliente con
// `useMemo` y también testear sin navegador.
// =============================================================================

/** Máximo de caracteres por fragmento (≈10 s de voz a velocidad 1x). */
export const MAX_CHUNK_CHARS = 150;

/**
 * Velocidad de habla en caracteres por segundo a rate = 1.
 *
 * Medida sobre voces en español (≈170 palabras/min). Es una ESTIMACIÓN: la Web
 * Speech API no informa de la duración de una locución, así que el temporizador
 * y la duración total del reproductor se calculan a partir de este número. El
 * error típico es de un ~10 %, suficiente para una barra de progreso.
 */
export const CHARS_PER_SECOND = 14.5;

/** Lo que se narra de una lección: su encabezado y su cuerpo. */
export interface NarrationSource {
  title: string;
  summary: string;
  /** Contenido de la lección en Markdown (`Lesson.content`). */
  content: string;
}

// Emojis y símbolos decorativos: se eliminan porque los lectores de voz los
// verbalizan ("cara sonriente") y rompen por completo el tono de podcast.
const DECORATIVE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{2022}]/gu;

/** Quita el marcado que va dentro de una línea (énfasis, enlaces, código). */
function plainInline(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // imagen → texto alternativo
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // enlace → solo su texto
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(DECORATIVE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Añade punto final si la frase no lo trae (marca la pausa al narrar).
 *
 * Las comillas y paréntesis de cierre no cuentan: una cita ya terminada en
 * punto no necesita otro ("…finanzas." no debe volverse "…finanzas.".).
 */
function asSentence(text: string): string {
  const core = text.replace(/["'»”’)\]]+$/, "");
  return /[.!?…:;]$/.test(core) ? text : `${text}.`;
}

/** Compara dos textos ignorando mayúsculas y puntuación final. */
function sameText(a: string, b: string): boolean {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[.!?…:;"'»”’)\]\s]+$/, "")
      .trim();
  return normalize(a) === normalize(b);
}

/**
 * Markdown → lista de bloques de texto plano, uno por línea con contenido.
 *
 * Cada bloque termina en signo de puntuación para que la voz haga una pausa
 * natural entre títulos, viñetas y párrafos (leídos de corrido sonarían como
 * una sola frase interminable).
 */
function plainBlocks(markdown: string): string[] {
  const blocks: string[] = [];

  for (const rawLine of markdown.split("\n")) {
    let line = rawLine.trim();
    if (line === "") continue;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue; // separador horizontal
    if (/^\|[\s:|-]+\|$/.test(line)) continue; // fila separadora de tabla

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      line = heading[1];
    } else if (line.startsWith(">")) {
      line = line.replace(/^>+\s?/, "");
    } else if (/^[-*+]\s+/.test(line)) {
      line = line.replace(/^[-*+]\s+/, "");
    } else if (/^\d+[.)]\s+/.test(line)) {
      line = line.replace(/^\d+[.)]\s+/, "");
    }

    // Fila de tabla: las celdas se narran como una enumeración.
    if (line.startsWith("|")) {
      line = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(", ");
    }

    const clean = plainInline(line);
    if (clean) blocks.push(asSentence(clean));
  }

  return blocks;
}

/**
 * Parte un bloque en frases. Un punto entre dígitos NO corta: en "$4.990" es un
 * separador de miles, no un final de frase.
 */
function splitSentences(block: string): string[] {
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < block.length; i += 1) {
    const char = block[i];
    if (char !== "." && char !== "!" && char !== "?" && char !== "…") continue;

    // Agrupa los signos consecutivos y las comillas de cierre ("...", "?!", ".»).
    let end = i + 1;
    while (end < block.length && ".!?…\"')]».".indexOf(block[end]) !== -1) end += 1;

    if (char === "." && /\d/.test(block[i - 1] ?? "") && /\d/.test(block[end] ?? "")) {
      i = end - 1;
      continue;
    }

    const piece = block.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
    i = end - 1;
  }

  const tail = block.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** Trocea por palabras una frase más larga que un fragmento. */
function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK_CHARS) return [sentence];

  const pieces: string[] = [];
  let current = "";
  for (const word of sentence.split(/\s+/)) {
    if (current === "") current = word;
    else if (current.length + 1 + word.length <= MAX_CHUNK_CHARS) current = `${current} ${word}`;
    else {
      pieces.push(current);
      current = word;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Construye el guion de narración de una lección.
 *
 * Empieza por el título y el objetivo de aprendizaje (la "entradilla" del
 * episodio) y sigue con el cuerpo. Los fragmentos nunca cruzan un bloque: así
 * cada título y cada viñeta arrancan con su propia locución y se oye la pausa.
 */
export function buildNarration(source: NarrationSource): string[] {
  const titleText = plainInline(source.title);
  const intro = [titleText, plainInline(source.summary)].filter(Boolean).map(asSentence);

  const body = plainBlocks(source.content);
  // Casi todas las lecciones abren con un `##` que repite el título; escuchado
  // suena a tartamudeo, así que se narra una sola vez.
  if (body.length > 0 && titleText && sameText(body[0] ?? "", titleText)) body.shift();

  const chunks: string[] = [];

  for (const block of [...intro, ...body]) {
    let current = "";
    for (const sentence of splitSentences(block)) {
      for (const piece of splitLongSentence(sentence)) {
        if (current === "") current = piece;
        else if (current.length + 1 + piece.length <= MAX_CHUNK_CHARS) {
          current = `${current} ${piece}`;
        } else {
          chunks.push(current);
          current = piece;
        }
      }
    }
    if (current) chunks.push(current);
  }

  return chunks;
}

/** Longitud total del guion, contando el separador entre fragmentos. */
export function narrationLength(chunks: string[]): number {
  return chunks.reduce((total, chunk) => total + chunk.length + 1, 0);
}

/** Duración estimada en segundos de `chars` caracteres a esa velocidad. */
export function estimateSeconds(chars: number, rate: number): number {
  if (chars <= 0 || rate <= 0) return 0;
  return chars / (CHARS_PER_SECOND * rate);
}

/** Segundos → "m:ss" (formato de reproductor). */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
