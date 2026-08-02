// =============================================================================
// Tests de Diagnóstico — pools de preguntas por categoría y reglas de puntuación
//
// Sustituye a la antigua selección manual de "Nivel de conocimiento": en vez de
// preguntarle al estudiante qué nivel cree tener (poco fiable, y una decisión
// que aún no sabe tomar), se lo medimos con un test corto y le asignamos el
// nivel que usa el tutor para adaptar sus explicaciones.
//
// El diagnóstico está partido por las mismas dos categorías del currículum
// ("Finanzas Personales" e "Inversiones") porque son dos competencias que van
// por separado: se puede llevar un presupuesto impecable sin haber comprado
// nunca un ETF, y al revés. Medirlas juntas producía un nivel promedio que no
// describía bien ninguna de las dos y convalidaba módulos de una categoría con
// aciertos de la otra. Ahora cada categoría tiene su pool, su puntaje, su nivel
// y su convalidación; el estudiante elige evaluarse en una o en ambas.
//
// Igual que el currículum, el contenido vive en código: son preguntas que
// cambian poco, y así quedan versionadas, tipadas y sin migraciones por cada
// ajuste de texto. La BD solo guarda el resultado (ver `lib/financial-level`).
//
// El pool es la ÚNICA fuente de verdad de las respuestas correctas Y de la
// categoría de cada pregunta: el cliente manda los ids elegidos y el servidor
// recalcula el puntaje contra este archivo (ver `saveDiagnosticResult` en
// `app/profile/actions.ts`). Así el navegador no puede regalarse un nivel
// avanzado ni colar preguntas de otra categoría.
//
// Este módulo lo importan Client Components, así que NO importa `curriculum.ts`
// (3.700 líneas de contenido que no tienen por qué viajar al navegador): las
// categorías se declaran aquí y TypeScript verifica que coinciden con las del
// currículum en cada llamada a `lib/placement`.
// =============================================================================

import type { FinancialLevel } from "@/lib/types";

/** Ruta de la pantalla del test (la usan los CTA y el onboarding). */
export const DIAGNOSTIC_PATH = "/diagnostico";

// -----------------------------------------------------------------------------
// Categorías y alcance del test
// -----------------------------------------------------------------------------

/**
 * Categorías evaluables. Son literalmente las del currículum (`lib/curriculum`),
 * repetidas aquí para no arrastrar el contenido del curso al bundle del cliente.
 * No hace falta una comprobación explícita de que coinciden: `lib/placement`
 * recibe estos valores tipados como `Category`, así que renombrar una categoría
 * en el currículum y no aquí rompe la compilación.
 */
export const DIAGNOSTIC_CATEGORIES = ["Finanzas Personales", "Inversiones"] as const;

export type DiagnosticCategory = (typeof DIAGNOSTIC_CATEGORIES)[number];

export interface DiagnosticCategoryMeta {
  emoji: string;
  /** Nombre corto para chips y títulos donde no cabe el nombre completo. */
  short: string;
  /** Qué mide, en una línea: es lo que lee el estudiante al elegir. */
  blurb: string;
}

export const CATEGORY_META: Record<DiagnosticCategory, DiagnosticCategoryMeta> = {
  "Finanzas Personales": {
    emoji: "💰",
    short: "Personales",
    blurb: "Presupuesto, ahorro, fondo de emergencia, deudas y el interés de los créditos.",
  },
  Inversiones: {
    emoji: "📈",
    short: "Inversiones",
    blurb: "ETFs, acciones, APV, depósitos a plazo, renta fija/variable y tributación.",
  },
};

/**
 * Qué se evalúa en este intento: una categoría concreta o las dos.
 *
 * "Ambas" no mezcla las preguntas en un solo puntaje: son dos tests seguidos,
 * cada uno con su nota y su nivel. Lo único que comparten es la pantalla.
 */
export type DiagnosticScope = DiagnosticCategory | "Ambas";

export const DIAGNOSTIC_SCOPES = [
  "Finanzas Personales",
  "Inversiones",
  "Ambas",
] as const;

export const DEFAULT_DIAGNOSTIC_SCOPE: DiagnosticScope = "Finanzas Personales";

export interface DiagnosticScopeOption {
  key: DiagnosticScope;
  emoji: string;
  label: string;
  description: string;
}

export const DIAGNOSTIC_SCOPE_OPTIONS: DiagnosticScopeOption[] = [
  {
    key: "Finanzas Personales",
    emoji: CATEGORY_META["Finanzas Personales"].emoji,
    label: "Finanzas Personales",
    description: CATEGORY_META["Finanzas Personales"].blurb,
  },
  {
    key: "Inversiones",
    emoji: CATEGORY_META.Inversiones.emoji,
    label: "Inversiones",
    description: CATEGORY_META.Inversiones.blurb,
  },
  {
    key: "Ambas",
    emoji: "🧭",
    label: "Ambas categorías",
    description:
      "Los dos tests seguidos, con un nivel independiente para cada categoría. Es el diagnóstico más completo.",
  },
];

/** Categorías que cubre un alcance, en el orden en que se presentan. */
export function categoriesForScope(scope: DiagnosticScope): DiagnosticCategory[] {
  return scope === "Ambas" ? [...DIAGNOSTIC_CATEGORIES] : [scope];
}

/** True si el valor recibido (p. ej. del cliente) es un alcance válido. */
export function isDiagnosticScope(value: unknown): value is DiagnosticScope {
  return DIAGNOSTIC_SCOPES.some((s) => s === value);
}

// -----------------------------------------------------------------------------
// Profundidad del test
// -----------------------------------------------------------------------------

/** Las tres profundidades que puede elegir el estudiante antes de empezar. */
export type DiagnosticDepth = "quick" | "recommended" | "deep";

export interface DiagnosticDepthOption {
  key: DiagnosticDepth;
  emoji: string;
  label: string;
  /** Cuántas preguntas se sortean del pool POR CATEGORÍA evaluada. */
  questionCount: number;
  /** Duración estimada por categoría, en minutos (para "~2 min"). */
  estimatedMinutes: number;
  /**
   * Precisión declarada del diagnóstico: qué tan fiable es el nivel asignado
   * con esa cantidad de preguntas. Es una estimación de producto, no una
   * medida psicométrica; se muestra para que el usuario elija con criterio.
   */
  accuracy: number;
  /** Frase de apoyo que se muestra en la tarjeta. */
  description: string;
}

/** Opción por defecto: 10 preguntas, el equilibrio entre tiempo y precisión. */
export const DEFAULT_DIAGNOSTIC_DEPTH: DiagnosticDepth = "recommended";

export const DIAGNOSTIC_DEPTHS: DiagnosticDepthOption[] = [
  {
    key: "quick",
    emoji: "⚡",
    label: "Rápido",
    questionCount: 5,
    estimatedMinutes: 2,
    accuracy: 65,
    description: "Un vistazo veloz para empezar hoy mismo. Puedes repetirlo cuando quieras.",
  },
  {
    key: "recommended",
    emoji: "🎯",
    label: "Recomendado",
    questionCount: 10,
    estimatedMinutes: 5,
    accuracy: 85,
    description: "El mejor equilibrio entre tiempo y acierto. Es el que sugerimos a casi todos.",
  },
  {
    key: "deep",
    emoji: "🔬",
    label: "Profundo",
    questionCount: 20,
    estimatedMinutes: 10,
    accuracy: 98,
    description: "Cubre todos los temas de la categoría a fondo, incluidos los más técnicos.",
  },
];

export function getDepthOption(depth: DiagnosticDepth): DiagnosticDepthOption {
  const option = DIAGNOSTIC_DEPTHS.find((d) => d.key === depth);
  if (!option) throw new Error(`Profundidad de test desconocida: ${depth}`);
  return option;
}

/** True si el valor recibido (p. ej. del cliente) es una profundidad válida. */
export function isDiagnosticDepth(value: unknown): value is DiagnosticDepth {
  return DIAGNOSTIC_DEPTHS.some((d) => d.key === value);
}

/**
 * Preguntas totales del intento. La profundidad se cuenta POR CATEGORÍA: elegir
 * "Ambas · Recomendado" son 10 preguntas de cada una, no 5 y 5. Es lo que hace
 * que un nivel de Inversiones signifique lo mismo se haya evaluado solo o junto
 * a Finanzas Personales.
 */
export function totalQuestionsFor(depth: DiagnosticDepth, scope: DiagnosticScope): number {
  return getDepthOption(depth).questionCount * categoriesForScope(scope).length;
}

// -----------------------------------------------------------------------------
// Temas
// -----------------------------------------------------------------------------

/**
 * Áreas que cubre el diagnóstico. Cada tema pertenece a UNA categoría: es lo
 * que decide a qué test va cada pregunta y qué nivel se ve afectado al fallarla.
 */
export type DiagnosticTopic =
  // Finanzas Personales
  | "presupuesto"
  | "ahorro-emergencias"
  | "deuda-credito"
  | "interes-compuesto"
  | "impuestos-personales"
  // Inversiones
  | "instrumentos"
  | "riesgo-cartera"
  | "previsional"
  | "tributacion-inversiones";

export interface DiagnosticTopicMeta {
  label: string;
  category: DiagnosticCategory;
}

export const TOPIC_META: Record<DiagnosticTopic, DiagnosticTopicMeta> = {
  presupuesto: { label: "Presupuesto y gastos", category: "Finanzas Personales" },
  "ahorro-emergencias": {
    label: "Ahorro y fondo de emergencia",
    category: "Finanzas Personales",
  },
  "deuda-credito": { label: "Deuda y crédito", category: "Finanzas Personales" },
  "interes-compuesto": { label: "Interés compuesto", category: "Finanzas Personales" },
  "impuestos-personales": {
    label: "Impuestos y unidades",
    category: "Finanzas Personales",
  },
  instrumentos: { label: "Instrumentos de inversión", category: "Inversiones" },
  "riesgo-cartera": { label: "Riesgo y cartera", category: "Inversiones" },
  previsional: { label: "APV y ahorro previsional", category: "Inversiones" },
  "tributacion-inversiones": {
    label: "Tributación de inversiones",
    category: "Inversiones",
  },
};

/** Etiqueta legible de un tema (chip de la pregunta). */
export const TOPIC_LABELS: Record<DiagnosticTopic, string> = Object.fromEntries(
  Object.entries(TOPIC_META).map(([topic, meta]) => [topic, meta.label]),
) as Record<DiagnosticTopic, string>;

/**
 * Dificultad de la pregunta. Determina el reparto del test (ver `DIFFICULTY_MIX`)
 * para que el porcentaje de aciertos sea comparable entre profundidades.
 */
export type DiagnosticDifficulty = "basic" | "intermediate" | "advanced";

export interface DiagnosticQuestion {
  /** Identificador estable: es lo que viaja al servidor para corregir. */
  id: string;
  topic: DiagnosticTopic;
  difficulty: DiagnosticDifficulty;
  prompt: string;
  /** Opciones en orden; el índice de la correcta es `correctIndex`. */
  options: string[];
  correctIndex: number;
  /** Se muestra en el repaso del resultado (el test también enseña). */
  explanation: string;
}

/** Categoría a la que pertenece una pregunta (la de su tema). */
export function questionCategory(question: DiagnosticQuestion): DiagnosticCategory {
  return TOPIC_META[question.topic].category;
}

// -----------------------------------------------------------------------------
// Omitir una pregunta ("No lo sé")
// -----------------------------------------------------------------------------

/**
 * Índice que manda el cliente cuando el estudiante elige "No lo sé / Omitir".
 *
 * Existe porque adivinar contamina la medición: con cuatro alternativas, quien
 * responde al azar acierta ~25% de las veces, y ese ruido se traduce en módulos
 * convalidados que no se dominan. Declarar la duda es información útil —vale
 * más un "no lo sé" honesto que un acierto de suerte—, así que la omisión es una
 * opción de primera clase y no un descuido.
 */
export const SKIPPED_ANSWER = -1;

/**
 * True si la respuesta no señala ninguna alternativa real de la pregunta.
 *
 * La regla se define por lo que NO es una alternativa válida, en vez de comparar
 * contra `SKIPPED_ANSWER`: así el servidor trata igual la omisión deliberada y
 * cualquier índice inventado o fuera de rango que llegue del navegador. En los
 * dos casos el resultado es el mismo (cero puntos), pero queda registrado como
 * omitida en vez de como error, que es lo honesto.
 */
export function isSkippedAnswer(question: DiagnosticQuestion, selectedIndex: number): boolean {
  return (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= question.options.length
  );
}

// =============================================================================
// POOL A — Finanzas Personales
// Presupuesto, ahorro, fondo de emergencia, deuda y el interés de los créditos.
// =============================================================================

const PERSONAL_FINANCE_QUESTIONS: DiagnosticQuestion[] = [
  // ---------------------------------------------------------------------------
  // Presupuesto y gastos
  // ---------------------------------------------------------------------------
  {
    id: "pre-01",
    topic: "presupuesto",
    difficulty: "basic",
    prompt: "En la regla 50/30/20, ¿a qué corresponde el 20%?",
    options: [
      "A los gastos de arriendo y cuentas básicas",
      "Al ahorro y al pago de deudas",
      "A los gastos de entretención",
      "A los impuestos del mes",
    ],
    correctIndex: 1,
    explanation:
      "La regla 50/30/20 reparte el ingreso líquido en 50% necesidades, 30% deseos y 20% ahorro o pago de deudas.",
  },
  {
    id: "pre-03",
    topic: "presupuesto",
    difficulty: "basic",
    prompt: "¿Qué es un «gasto hormiga»?",
    options: [
      "Un gasto grande e imprevisto, como una urgencia médica",
      "Una cuota fija que se paga todos los meses",
      "Un gasto pequeño y frecuente que, sumado, pesa mucho al mes",
      "Un gasto que se paga en cuotas sin interés",
    ],
    correctIndex: 2,
    explanation:
      "Los gastos hormiga son pequeños y repetidos (café, delivery, suscripciones). Individualmente parecen inofensivos; su daño está en la suma mensual.",
  },
  {
    id: "fp-01",
    topic: "presupuesto",
    difficulty: "basic",
    prompt: "¿Sobre qué cifra deberías armar tu presupuesto mensual?",
    options: [
      "Sobre el sueldo bruto, porque es el que aparece en el contrato",
      "Sobre el sueldo líquido, que es lo que efectivamente llega a tu cuenta",
      "Sobre el sueldo bruto menos el arriendo",
      "Sobre el promedio de los últimos tres años",
    ],
    correctIndex: 1,
    explanation:
      "El bruto incluye descuentos que nunca ves (AFP, salud, impuesto). Presupuestar sobre él infla tu capacidad de gasto: el número real es el líquido.",
  },
  {
    id: "pre-04",
    topic: "presupuesto",
    difficulty: "intermediate",
    prompt: "¿En qué consiste un presupuesto de base cero?",
    options: [
      "En gastar cero en categorías no esenciales",
      "En asignar cada peso del ingreso a una categoría hasta que no quede nada sin destino",
      "En partir el mes con saldo cero en la cuenta corriente",
      "En no usar deuda de ningún tipo",
    ],
    correctIndex: 1,
    explanation:
      "En el presupuesto base cero cada peso recibe un destino (gasto, ahorro o deuda) antes de empezar el mes: ingreso − asignaciones = 0.",
  },
  {
    id: "fp-06",
    topic: "presupuesto",
    difficulty: "intermediate",
    prompt:
      "Tu sueldo sube 4% en un año en que la inflación fue 6%. ¿Qué pasó con tu poder adquisitivo?",
    options: [
      "Subió 4%: ganas más plata que antes",
      "Se mantuvo igual, porque ambos subieron",
      "Bajó cerca de 2%: tu sueldo compra menos que el año pasado",
      "Depende solo del valor del dólar",
    ],
    correctIndex: 2,
    explanation:
      "Lo que importa es el aumento REAL: 4% − 6% ≈ −2%. Un reajuste por debajo de la inflación es, en la práctica, una rebaja de sueldo.",
  },
  {
    id: "fp-09",
    topic: "presupuesto",
    difficulty: "advanced",
    prompt:
      "Tu crédito hipotecario está en UF y tu sueldo en pesos. Si la inflación se acelera durante un año, ¿qué ocurre?",
    options: [
      "El dividendo en pesos sube, porque la UF se reajusta con el IPC",
      "El dividendo en pesos se mantiene fijo hasta el término del crédito",
      "El dividendo baja, porque la deuda se licúa con la inflación",
      "El banco debe convertir el crédito a pesos automáticamente",
    ],
    correctIndex: 0,
    explanation:
      "La UF se reajusta con el IPC, así que el dividendo expresado en pesos sube con la inflación mientras tu sueldo nominal puede no seguirle el ritmo. Ese descalce es el riesgo real de deber en UF y ganar en pesos.",
  },

  // ---------------------------------------------------------------------------
  // Ahorro y fondo de emergencia
  // ---------------------------------------------------------------------------
  {
    id: "pre-02",
    topic: "ahorro-emergencias",
    difficulty: "basic",
    prompt: "¿Cuánto suele recomendarse tener en un fondo de emergencia?",
    options: [
      "Entre 3 y 6 meses de gastos",
      "Un sueldo completo, sin importar los gastos",
      "El 50% del ingreso anual",
      "No hace falta si tienes tarjeta de crédito",
    ],
    correctIndex: 0,
    explanation:
      "El fondo de emergencia se mide en MESES DE GASTOS (3 a 6 como referencia), porque su función es cubrirte si el ingreso se corta.",
  },
  {
    id: "fp-02",
    topic: "ahorro-emergencias",
    difficulty: "basic",
    prompt: "¿Dónde conviene tener el fondo de emergencia?",
    options: [
      "En acciones, para que crezca lo más posible",
      "En un instrumento seguro y de liquidez inmediata, aunque rinda poco",
      "En efectivo bajo el colchón, para que nadie lo toque",
      "En un depósito a 5 años, para no gastarlo",
    ],
    correctIndex: 1,
    explanation:
      "El fondo de emergencia se juzga por disponibilidad, no por rentabilidad: debe estar completo y accesible el día que lo necesitas. Rendir poco es el precio de que esté ahí.",
  },
  {
    id: "fp-05",
    topic: "ahorro-emergencias",
    difficulty: "intermediate",
    prompt: "¿Qué significa «págate a ti primero»?",
    options: [
      "Darte un gusto apenas te pagan, antes de que se acabe el mes",
      "Apartar el ahorro apenas recibes el sueldo, antes de empezar a gastar",
      "Pagar primero las deudas y después el arriendo",
      "Cobrarle a quien te deba plata antes de pagar tus cuentas",
    ],
    correctIndex: 1,
    explanation:
      "Ahorrar «lo que sobre» a fin de mes casi nunca funciona. Apartar el monto al inicio (idealmente con una transferencia automática) convierte el ahorro en un gasto fijo más.",
  },
  {
    id: "pre-07",
    topic: "ahorro-emergencias",
    difficulty: "advanced",
    prompt:
      "Dos personas ganan lo mismo. La primera ahorra el 10% de su ingreso y la segunda el 30%. ¿Qué efecto tiene esto sobre los años que necesitan para vivir de sus ahorros?",
    options: [
      "Ninguno: lo que manda es la rentabilidad de las inversiones",
      "La segunda tarda tres veces menos, exactamente",
      "La segunda tarda bastante menos, porque ahorra más y a la vez necesita menos para vivir",
      "Es imposible estimarlo sin conocer el monto del sueldo",
    ],
    correctIndex: 2,
    explanation:
      "La tasa de ahorro actúa por dos lados: acumulas más rápido y, como gastas menos, el capital que necesitas para cubrir tu vida también es más bajo. Por eso pesa más que unas décimas de rentabilidad.",
  },

  // ---------------------------------------------------------------------------
  // Deuda y crédito
  // ---------------------------------------------------------------------------
  {
    id: "fp-03",
    topic: "deuda-credito",
    difficulty: "basic",
    prompt: "Compras un electrodoméstico en 12 cuotas «con interés». ¿Qué significa eso?",
    options: [
      "Que pagarás en total más que el precio contado",
      "Que pagarás exactamente el precio contado, repartido en 12 meses",
      "Que el precio se reajusta solo si sube la inflación",
      "Que la tienda te cobra una comisión única al final",
    ],
    correctIndex: 0,
    explanation:
      "El interés es el precio de pagar después. Con interés, la suma de las 12 cuotas supera el precio contado: la diferencia es lo que te cuesta el crédito.",
  },
  {
    id: "pre-05",
    topic: "deuda-credito",
    difficulty: "intermediate",
    prompt:
      "Si tienes varias deudas y quieres pagar la MENOR cantidad total de intereses, ¿cuál conviene atacar primero?",
    options: [
      "La de saldo más pequeño",
      "La más antigua",
      "La de tasa de interés más alta",
      "La que tenga más cuotas pendientes",
    ],
    correctIndex: 2,
    explanation:
      "Atacar primero la tasa más alta (método «avalancha») minimiza el interés total pagado. El método «bola de nieve» (saldo más pequeño) cuesta más, pero motiva antes.",
  },
  {
    id: "fp-04",
    topic: "deuda-credito",
    difficulty: "intermediate",
    prompt: "¿Qué pasa si cada mes pagas solo el «pago mínimo» de tu tarjeta de crédito?",
    options: [
      "Quedas al día y no se generan intereses",
      "El saldo restante sigue generando intereses y la deuda puede tardar años en pagarse",
      "El banco congela la deuda hasta que puedas pagarla completa",
      "Se te rebaja automáticamente la tasa por buen comportamiento",
    ],
    correctIndex: 1,
    explanation:
      "El pago mínimo evita la mora, no el interés: el saldo no pagado sigue devengando la tasa rotativa, que es de las más caras del sistema. Es la vía más común para que una deuda pequeña se vuelva grande.",
  },
  {
    id: "pre-06",
    topic: "deuda-credito",
    difficulty: "advanced",
    prompt: "En un crédito de consumo en Chile, ¿qué muestra la CAE (Carga Anual Equivalente)?",
    options: [
      "Solo la tasa de interés que cobra el banco",
      "El costo total anual del crédito: interés más comisiones, seguros y gastos asociados",
      "El monto máximo que puedes pedir según tu renta",
      "El reajuste por inflación del crédito",
    ],
    correctIndex: 1,
    explanation:
      "La CAE unifica interés, comisiones, seguros y gastos en un solo porcentaje anual: por eso es la cifra correcta para comparar créditos entre instituciones.",
  },
  {
    id: "fp-07",
    topic: "deuda-credito",
    difficulty: "advanced",
    prompt:
      "Te ofrecen repactar tu deuda bajando la cuota mensual y alargando el plazo, con la misma tasa. ¿Qué ocurre con el costo total?",
    options: [
      "Baja, porque pagas menos cada mes",
      "Se mantiene igual: solo cambia el calendario de pagos",
      "Sube, porque el interés se aplica sobre el saldo durante más tiempo",
      "Depende exclusivamente del banco que ofrezca la repactación",
    ],
    correctIndex: 2,
    explanation:
      "Alargar el plazo alivia el flujo mensual pero mantiene el saldo devengando interés durante más meses: el total pagado sube. Repactar sirve para no caer en mora, no para ahorrar.",
  },

  // ---------------------------------------------------------------------------
  // Interés compuesto
  // ---------------------------------------------------------------------------
  {
    id: "int-01",
    topic: "interes-compuesto",
    difficulty: "basic",
    prompt: "¿Qué distingue al interés compuesto del interés simple?",
    options: [
      "Que la tasa cambia cada año",
      "Que los intereses se calculan sobre el capital MÁS los intereses ya acumulados",
      "Que solo se aplica a las deudas",
      "Que se paga al final y no mes a mes",
    ],
    correctIndex: 1,
    explanation:
      "En el interés compuesto los intereses también generan intereses. En el simple, siempre se calcula sobre el capital inicial.",
  },
  {
    id: "int-02",
    topic: "interes-compuesto",
    difficulty: "basic",
    prompt: "¿Cuál es la variable que más potencia el interés compuesto?",
    options: ["El tiempo", "El banco que elijas", "El día del mes en que aportes", "La inflación"],
    correctIndex: 0,
    explanation:
      "El crecimiento es exponencial en el tiempo: los últimos años aportan mucho más que los primeros. Por eso empezar temprano vale más que aportar mucho tarde.",
  },
  {
    id: "int-03",
    topic: "interes-compuesto",
    difficulty: "basic",
    prompt:
      "Inviertes $1.000.000 al 10% anual. ¿Cuánto tendrás al cabo de dos años si los intereses se reinvierten?",
    options: ["$1.100.000", "$1.200.000", "$1.210.000", "$1.020.000"],
    correctIndex: 2,
    explanation:
      "Año 1: $1.100.000. Año 2: 10% sobre $1.100.000 = $110.000, o sea $1.210.000. Esos $10.000 extra sobre el interés simple son el efecto compuesto.",
  },
  {
    id: "int-04",
    topic: "interes-compuesto",
    difficulty: "intermediate",
    prompt:
      "Según la «regla del 72», ¿en cuántos años se duplica aproximadamente una inversión que rinde 8% anual?",
    options: ["Unos 5 años", "Unos 9 años", "Unos 12 años", "Unos 18 años"],
    correctIndex: 1,
    explanation:
      "La regla del 72 divide 72 entre la tasa: 72 / 8 = 9 años. Es una aproximación mental muy útil para tasas moderadas.",
  },
  {
    id: "int-05",
    topic: "interes-compuesto",
    difficulty: "intermediate",
    prompt: "¿Qué ocurre si cada año retiras las ganancias de tu inversión en vez de reinvertirlas?",
    options: [
      "Nada: el capital crece igual",
      "Pierdes el efecto compuesto y el crecimiento pasa a ser lineal",
      "El capital se reduce cada año",
      "Pagas menos impuestos y por eso creces más",
    ],
    correctIndex: 1,
    explanation:
      "El interés compuesto necesita que las ganancias se queden dentro. Si las retiras, siempre rentas sobre el mismo capital: eso es interés simple.",
  },
  {
    id: "int-06",
    topic: "interes-compuesto",
    difficulty: "advanced",
    prompt:
      "Una inversión rinde 7% nominal en un año con 4% de inflación. ¿Cuál es su rentabilidad REAL aproximada?",
    options: ["11%", "7%", "3%", "1,75%"],
    correctIndex: 2,
    explanation:
      "La rentabilidad real es, en aproximación, nominal − inflación: 7% − 4% ≈ 3%. Es lo que efectivamente aumentó tu poder de compra.",
  },
  {
    id: "int-07",
    topic: "interes-compuesto",
    difficulty: "advanced",
    prompt:
      "Dos depósitos ofrecen 12% nominal anual: uno capitaliza una vez al año y el otro cada mes. ¿Cuál entrega más al cabo de un año?",
    options: [
      "El de capitalización mensual",
      "El de capitalización anual",
      "Los dos entregan exactamente lo mismo",
      "Depende del monto invertido",
    ],
    correctIndex: 0,
    explanation:
      "A mayor frecuencia de capitalización, mayor rendimiento efectivo: 12% nominal capitalizado mensualmente equivale a ≈12,68% efectivo anual.",
  },

  // ---------------------------------------------------------------------------
  // Impuestos y unidades de cuenta (del día a día)
  // ---------------------------------------------------------------------------
  {
    id: "imp-01",
    topic: "impuestos-personales",
    difficulty: "basic",
    prompt: "¿Cuál es la tasa general del IVA en Chile?",
    options: ["10%", "19%", "21%", "25%"],
    correctIndex: 1,
    explanation:
      "El IVA general en Chile es 19% y ya viene incluido en el precio que ves en la boleta.",
  },
  {
    id: "imp-02",
    topic: "impuestos-personales",
    difficulty: "basic",
    prompt: "¿Qué es la UF (Unidad de Fomento)?",
    options: [
      "Una moneda extranjera usada en Chile",
      "Una unidad de cuenta que se reajusta según la inflación (IPC)",
      "Un impuesto aplicado a los créditos hipotecarios",
      "El valor fijo del dólar definido por el Banco Central",
    ],
    correctIndex: 1,
    explanation:
      "La UF se reajusta a diario según el IPC del mes anterior: expresar un crédito o un arriendo en UF protege ese valor de la inflación.",
  },
  {
    id: "imp-03",
    topic: "impuestos-personales",
    difficulty: "intermediate",
    prompt: "¿Cómo funciona el Impuesto Global Complementario?",
    options: [
      "Es una tasa plana igual para todas las rentas",
      "Es anual y progresivo: la tasa sube por tramos a medida que aumenta la renta",
      "Se paga solo por los ingresos de inversiones extranjeras",
      "Lo pagan únicamente las empresas",
    ],
    correctIndex: 1,
    explanation:
      "El Global Complementario es anual y progresivo por tramos: solo la parte de renta que entra en un tramo superior paga la tasa más alta.",
  },
  {
    id: "imp-04",
    topic: "impuestos-personales",
    difficulty: "intermediate",
    prompt: "¿Para qué se usa la UTM (Unidad Tributaria Mensual)?",
    options: [
      "Para fijar el sueldo mínimo",
      "Para expresar multas, tramos y topes tributarios; se reajusta cada mes",
      "Para calcular el precio de las acciones en bolsa",
      "Para convertir pesos a dólares en operaciones de comercio exterior",
    ],
    correctIndex: 1,
    explanation:
      "La UTM es la unidad reajustable con la que el SII expresa multas, tramos de impuesto y topes de beneficios (por ejemplo, el tope del APV régimen A).",
  },
  {
    id: "imp-07",
    topic: "impuestos-personales",
    difficulty: "advanced",
    prompt: "¿Cómo paga sus impuestos un trabajador dependiente en Chile?",
    options: [
      "Declara y paga todo en abril, sin retenciones durante el año",
      "El empleador le retiene mes a mes el Impuesto Único de Segunda Categoría",
      "No paga impuesto a la renta, solo IVA",
      "Paga una tasa fija del 15% sobre su sueldo bruto",
    ],
    correctIndex: 1,
    explanation:
      "El empleador retiene mensualmente el Impuesto Único de Segunda Categoría (también progresivo). La declaración anual sirve para reliquidar y aplicar beneficios como el APV.",
  },
  {
    id: "fp-08",
    topic: "impuestos-personales",
    difficulty: "advanced",
    prompt:
      "Un aumento de sueldo te hace entrar en un tramo con tasa marginal más alta. ¿Qué significa eso?",
    options: [
      "Toda tu renta pasa a pagar la tasa más alta y puedes terminar ganando menos",
      "Solo la parte de renta que excede el límite del tramo anterior paga la tasa más alta",
      "Pagas la tasa más alta durante los siguientes 12 meses y luego vuelves al tramo anterior",
      "Quedas exento hasta la siguiente declaración anual",
    ],
    correctIndex: 1,
    explanation:
      "El impuesto es progresivo por tramos, no escalonado sobre el total: por eso la tasa efectiva (impuesto / renta total) siempre es menor que la marginal. Subir de tramo nunca te deja con menos plata en el bolsillo.",
  },
];

// =============================================================================
// POOL B — Inversiones
// ETFs, acciones, APV (regímenes A y B), depósitos a plazo, renta variable y
// fija, y la tributación de todo lo anterior (incluido el Art. 107 LIR).
// =============================================================================

const INVESTING_QUESTIONS: DiagnosticQuestion[] = [
  // ---------------------------------------------------------------------------
  // Instrumentos de inversión
  // ---------------------------------------------------------------------------
  {
    id: "inv-01",
    topic: "instrumentos",
    difficulty: "basic",
    prompt: "¿Qué es un ETF?",
    options: [
      "Un depósito a plazo con tasa garantizada",
      "Un fondo que suele replicar un índice y se transa en bolsa como una acción",
      "Un seguro de vida con ahorro",
      "Un crédito con garantía de inversión",
    ],
    correctIndex: 1,
    explanation:
      "Un ETF (fondo cotizado) agrupa muchos instrumentos —normalmente replicando un índice— y sus cuotas se compran y venden en bolsa durante la jornada.",
  },
  {
    id: "iv-01",
    topic: "instrumentos",
    difficulty: "basic",
    prompt: "¿Qué es un depósito a plazo?",
    options: [
      "Dejar dinero en el banco por un período pactado a cambio de una tasa de interés conocida de antemano",
      "Una cuenta de la que puedes retirar cuando quieras sin costo",
      "Una participación en las utilidades del banco",
      "Un crédito que el banco te otorga contra tus ahorros",
    ],
    correctIndex: 0,
    explanation:
      "El depósito a plazo es renta fija: entregas el capital por un plazo definido y sabes desde el primer día cuánto recibirás al vencimiento. A cambio, retirar antes suele no ser posible o tener costo.",
  },
  {
    id: "iv-02",
    topic: "instrumentos",
    difficulty: "basic",
    prompt: "¿Qué representa una acción?",
    options: [
      "Un préstamo que le haces a una empresa y que ella debe devolverte",
      "Una fracción de la propiedad de una empresa",
      "Un seguro sobre el valor de un negocio",
      "Un derecho a comprar productos de la empresa con descuento",
    ],
    correctIndex: 1,
    explanation:
      "Comprar una acción es hacerse socio: te corresponde una parte de la propiedad y de las utilidades futuras. Prestarle plata a la empresa es un bono, que es otra cosa.",
  },
  {
    id: "iv-05",
    topic: "instrumentos",
    difficulty: "basic",
    prompt: "¿Qué es un fondo mutuo?",
    options: [
      "Un depósito garantizado por el Estado",
      "Un patrimonio formado por los aportes de muchas personas, que administra una AGF invirtiéndolo según la política del fondo",
      "Un crédito colectivo entre inversionistas",
      "Una cuenta de ahorro de las AFP",
    ],
    correctIndex: 1,
    explanation:
      "En un fondo mutuo muchos aportantes juntan capital y una Administradora General de Fondos lo invierte según el reglamento del fondo. Tú compras cuotas; no eliges los instrumentos uno a uno.",
  },
  {
    id: "iv-06",
    topic: "instrumentos",
    difficulty: "basic",
    prompt: "¿Qué es un dividendo?",
    options: [
      "La parte de las utilidades que una empresa reparte entre sus accionistas",
      "La comisión que cobra el corredor por cada operación",
      "El alza de precio de una acción durante el año",
      "El impuesto que se paga al vender una acción",
    ],
    correctIndex: 0,
    explanation:
      "El dividendo es utilidad repartida en efectivo a los accionistas. Es distinto de la ganancia de capital, que aparece solo cuando vendes la acción más cara de lo que la compraste.",
  },
  {
    id: "inv-05",
    topic: "instrumentos",
    difficulty: "intermediate",
    prompt: "¿En qué se diferencia principalmente un ETF de un fondo mutuo tradicional?",
    options: [
      "El ETF no tiene ningún costo de administración",
      "El fondo mutuo siempre rinde más",
      "El ETF se compra y vende en bolsa a precio de mercado durante la jornada; el fondo mutuo se suscribe y rescata al valor cuota del día",
      "El ETF solo puede invertir en acciones chilenas",
    ],
    correctIndex: 2,
    explanation:
      "La diferencia operativa clave es cómo entras y sales: bolsa en tiempo real (ETF) frente a valor cuota diario (fondo mutuo). Ambos cobran costos de administración.",
  },
  {
    id: "iv-10",
    topic: "instrumentos",
    difficulty: "intermediate",
    prompt:
      "Un depósito a plazo en pesos ofrece 6% anual y la inflación del año resulta ser 5%. ¿Qué ganaste realmente?",
    options: [
      "6%, que es la tasa pactada",
      "Cerca de 1% real: el resto solo compensó la pérdida de poder de compra",
      "11%, sumando tasa e inflación",
      "Nada, porque los depósitos no rinden sobre la inflación",
    ],
    correctIndex: 1,
    explanation:
      "En un depósito en pesos la tasa es nominal. La ganancia real es aproximadamente tasa − inflación: 6% − 5% ≈ 1%. Un depósito en UF, en cambio, paga una tasa POR SOBRE la inflación.",
  },
  {
    id: "iv-13",
    topic: "instrumentos",
    difficulty: "intermediate",
    prompt:
      "¿Qué ventaja tiene aportar un monto fijo todos los meses en vez de esperar el «momento ideal» para entrar?",
    options: [
      "Garantiza una rentabilidad mayor que invertir todo de una vez",
      "Elimina por completo el riesgo de perder dinero",
      "Promedia el precio de compra en el tiempo y evita depender de acertar el timing del mercado",
      "Permite no pagar impuestos por las ganancias",
    ],
    correctIndex: 2,
    explanation:
      "El aporte periódico compra más cuotas cuando el precio está bajo y menos cuando está alto, así que promedia el costo y quita de la ecuación la decisión más difícil: cuándo entrar. No garantiza ganar más ni elimina el riesgo.",
  },
  {
    id: "inv-07",
    topic: "instrumentos",
    difficulty: "advanced",
    prompt:
      "Dos ETFs siguen el mismo índice, pero uno cobra 0,05% anual y el otro 0,80%. En un horizonte de 25 años, esa diferencia de costos…",
    options: [
      "Es irrelevante frente a la rentabilidad del índice",
      "Se recupera con el mayor rendimiento del fondo más caro",
      "Resta una parte significativa del capital final, porque el costo se descuenta todos los años y se compone",
      "Solo afecta si vendes antes de tiempo",
    ],
    correctIndex: 2,
    explanation:
      "El costo anual se descuenta del capital cada año y arrastra el efecto compuesto hacia abajo. Con horizontes largos, 0,75 puntos de diferencia se convierten en una porción importante del resultado final.",
  },

  // ---------------------------------------------------------------------------
  // Riesgo y cartera (renta fija y variable)
  // ---------------------------------------------------------------------------
  {
    id: "inv-02",
    topic: "riesgo-cartera",
    difficulty: "basic",
    prompt: "¿Para qué sirve diversificar una cartera?",
    options: [
      "Para garantizar que nunca pierdas dinero",
      "Para aumentar siempre la rentabilidad esperada",
      "Para reducir el riesgo de que un solo activo te afecte demasiado",
      "Para pagar menos comisiones",
    ],
    correctIndex: 2,
    explanation:
      "Diversificar reduce el riesgo específico de un emisor o sector. No elimina el riesgo de mercado ni garantiza ganancias.",
  },
  {
    id: "iv-03",
    topic: "riesgo-cartera",
    difficulty: "basic",
    prompt: "¿Cuál es la diferencia entre renta fija y renta variable?",
    options: [
      "La renta fija nunca pierde valor y la variable sí",
      "En renta fija los pagos están pactados de antemano (bonos, depósitos); en renta variable el resultado depende de cómo le vaya al activo (acciones)",
      "La renta fija es para empresas y la variable para personas",
      "La renta variable solo existe fuera de Chile",
    ],
    correctIndex: 1,
    explanation:
      "Renta fija = flujos conocidos por contrato (aunque el precio del bono sí puede fluctuar). Renta variable = participas del resultado del negocio, para bien y para mal.",
  },
  {
    id: "iv-04",
    topic: "riesgo-cartera",
    difficulty: "basic",
    prompt: "¿Qué relación existe entre riesgo y rentabilidad esperada?",
    options: [
      "Son independientes: hay instrumentos de alta rentabilidad y riesgo cero",
      "A mayor rentabilidad esperada, mayor riesgo asumido",
      "A mayor riesgo, menor rentabilidad esperada",
      "La relación la fija la CMF cada año",
    ],
    correctIndex: 1,
    explanation:
      "Nadie paga más por asumir menos: la rentabilidad esperada más alta es la compensación por aceptar más incertidumbre. Si algo promete mucho «sin riesgo», la señal es de estafa.",
  },
  {
    id: "iv-08",
    topic: "riesgo-cartera",
    difficulty: "basic",
    prompt: "¿Por qué importa el horizonte de inversión al elegir dónde poner el dinero?",
    options: [
      "Porque los instrumentos cambian de nombre según el plazo",
      "Porque el dinero que necesitarás pronto no debería estar en instrumentos que pueden caer justo cuando lo retires",
      "Porque a corto plazo las acciones siempre rinden más",
      "Porque el SII exige declarar el plazo antes de invertir",
    ],
    correctIndex: 1,
    explanation:
      "El horizonte define cuánta volatilidad puedes tolerar. Plata para dentro de un año va en instrumentos estables; plata para dentro de veinte puede aguantar las caídas de la renta variable.",
  },
  {
    id: "iv-11",
    topic: "riesgo-cartera",
    difficulty: "intermediate",
    prompt: "Si las tasas de interés del mercado suben, ¿qué le pasa al precio de un bono ya emitido?",
    options: [
      "Sube, porque el bono paga más",
      "Baja, porque su cupón fijo queda menos atractivo frente a las nuevas emisiones",
      "No cambia: los bonos tienen precio fijo",
      "Depende solo de la clasificación de riesgo del emisor",
    ],
    correctIndex: 1,
    explanation:
      "El precio de un bono se mueve al revés que las tasas. Si hoy se emiten bonos con cupones más altos, el tuyo solo se vende más barato. Por eso la renta fija tampoco es «renta segura» si vendes antes del vencimiento.",
  },
  {
    id: "iv-12",
    topic: "riesgo-cartera",
    difficulty: "intermediate",
    prompt:
      "Tu cartera de acciones cae 20% en tres meses y tu horizonte es de 15 años. ¿Qué describe mejor la situación?",
    options: [
      "Una pérdida definitiva: conviene vender para no perder más",
      "Una caída dentro de lo esperable en renta variable, que solo se vuelve pérdida real si vendes",
      "Un error del corredor que debe ser reembolsado",
      "Una señal de que la empresa quebró",
    ],
    correctIndex: 1,
    explanation:
      "Las caídas de dos dígitos son parte normal del comportamiento de la renta variable. Mientras no vendas, la pérdida es contable; el daño real lo produce vender abajo por miedo.",
  },
  {
    id: "iv-16",
    topic: "riesgo-cartera",
    difficulty: "advanced",
    prompt:
      "Dos bonos pagan el mismo cupón, pero uno vence en 2 años y el otro en 20. Si las tasas suben 1%, ¿cuál cae más de precio?",
    options: [
      "El de 20 años, porque su mayor duración lo hace más sensible a la tasa",
      "El de 2 años, porque vence antes",
      "Los dos caen exactamente lo mismo",
      "Ninguno: el cupón protege el precio",
    ],
    correctIndex: 0,
    explanation:
      "La duración mide la sensibilidad del precio a la tasa: cuanto más lejos están los flujos, más pesa el descuento. Por eso la renta fija larga se comporta con mucha más volatilidad que la corta.",
  },
  {
    id: "iv-18",
    topic: "riesgo-cartera",
    difficulty: "advanced",
    prompt:
      "Un inversionista chileno compra un ETF global en dólares, sin cobertura cambiaria. ¿A qué riesgo adicional se expone?",
    options: [
      "A ninguno: el ETF ya está diversificado",
      "Al tipo de cambio: si el peso se aprecia frente al dólar, su rentabilidad medida en pesos baja",
      "A pagar IVA sobre las ganancias",
      "A que el ETF deje de replicar su índice",
    ],
    correctIndex: 1,
    explanation:
      "Al invertir en otra moneda tu resultado en pesos combina dos cosas: cómo le fue al activo y cómo se movió el dólar. Esa exposición puede ayudar o restar, y es parte del riesgo que se asume.",
  },

  // ---------------------------------------------------------------------------
  // APV y ahorro previsional
  // ---------------------------------------------------------------------------
  {
    id: "iv-07",
    topic: "previsional",
    difficulty: "basic",
    prompt: "¿Qué significa la sigla APV?",
    options: [
      "Aporte Previsional Vitalicio",
      "Ahorro Previsional Voluntario",
      "Administración Privada de Valores",
      "Ahorro Programado Variable",
    ],
    correctIndex: 1,
    explanation:
      "APV es Ahorro Previsional Voluntario: aportes que haces por sobre la cotización obligatoria para mejorar tu pensión, y que el Estado incentiva con beneficios tributarios.",
  },
  {
    id: "inv-03",
    topic: "previsional",
    difficulty: "intermediate",
    prompt: "¿Qué es el APV en Chile?",
    options: [
      "Un impuesto sobre las ganancias de capital",
      "El Ahorro Previsional Voluntario: aportes extra para complementar la pensión, con beneficio tributario",
      "Un tipo de crédito hipotecario en UF",
      "El seguro obligatorio de las AFP",
    ],
    correctIndex: 1,
    explanation:
      "El APV es un ahorro voluntario que se suma al obligatorio de la AFP. El Estado lo incentiva con un beneficio tributario, a elegir entre dos regímenes (A y B).",
  },
  {
    id: "inv-04",
    topic: "previsional",
    difficulty: "intermediate",
    prompt: "¿Cuál es el beneficio del APV en régimen B?",
    options: [
      "Una bonificación en efectivo depositada por el Estado",
      "Rebaja la base imponible del impuesto a la renta en el año del aporte (con tope anual)",
      "Exime de impuestos para siempre la rentabilidad del fondo",
      "Permite retirar el ahorro sin restricciones ni castigo",
    ],
    correctIndex: 1,
    explanation:
      "En el régimen B el aporte se descuenta de la base imponible del año (tope de 600 UF anuales), así que rebaja el impuesto hoy y tributa al retirar. Suele convenir a rentas más altas.",
  },
  {
    id: "inv-06",
    topic: "previsional",
    difficulty: "advanced",
    prompt: "¿A quién suele convenirle más el APV en régimen A?",
    options: [
      "A quien paga tasas altas de Global Complementario y busca rebajar impuestos hoy",
      "A quien paga poco o nada de impuesto a la renta, porque recibe una bonificación fiscal del 15% de lo ahorrado (con tope anual)",
      "A quien quiere retirar el dinero en menos de un año",
      "Solo a trabajadores independientes",
    ],
    correctIndex: 1,
    explanation:
      "El régimen A entrega una bonificación estatal del 15% del ahorro (tope de 6 UTM al año): sirve justamente a quien no tiene mucho impuesto que rebajar. El B, en cambio, apunta a rentas altas.",
  },
  {
    id: "iv-15",
    topic: "previsional",
    difficulty: "advanced",
    prompt: "¿Qué ocurre si retiras tu APV para un fin distinto de la pensión?",
    options: [
      "Nada: el retiro es libre y sin costo tributario",
      "Pierdes el beneficio obtenido: el retiro queda afecto a un impuesto único con recargo (o se te descuenta la bonificación recibida, según el régimen)",
      "Debes devolver el dinero a la AFP dentro de 12 meses",
      "Se convierte automáticamente en un depósito a plazo",
    ],
    correctIndex: 1,
    explanation:
      "El beneficio tributario existe porque el ahorro está destinado a la pensión. Al retirarlo antes para otro fin, el Estado recupera el incentivo: en el régimen B con un impuesto único de retiro con recargo, y en el A descontando la bonificación.",
  },

  // ---------------------------------------------------------------------------
  // Tributación de inversiones
  // ---------------------------------------------------------------------------
  {
    id: "iv-09",
    topic: "tributacion-inversiones",
    difficulty: "basic",
    prompt: "¿Las ganancias que obtienes al invertir pagan impuestos en Chile?",
    options: [
      "No: invertir está exento de impuestos",
      "Por regla general sí, salvo exenciones específicas que la ley define para ciertos instrumentos",
      "Solo si inviertes fuera de Chile",
      "Solo si superas los 100 millones de pesos",
    ],
    correctIndex: 1,
    explanation:
      "La regla es que las rentas de capital tributan (intereses, dividendos, mayor valor). Las exenciones existen, pero son casos concretos y con requisitos, no la norma general.",
  },
  {
    id: "imp-05",
    topic: "tributacion-inversiones",
    difficulty: "intermediate",
    prompt: "¿Cuándo tributa normalmente la ganancia obtenida en un fondo mutuo?",
    options: [
      "Cada mes, mientras el fondo suba",
      "Al momento del rescate, sobre el mayor valor obtenido",
      "Nunca: los fondos mutuos están exentos",
      "Al momento de suscribir las cuotas",
    ],
    correctIndex: 1,
    explanation:
      "Mientras el dinero sigue invertido no hay hecho gravado: la ganancia (mayor valor) se reconoce al rescatar. Por eso el diferimiento importa en horizontes largos.",
  },
  {
    id: "iv-14",
    topic: "tributacion-inversiones",
    difficulty: "intermediate",
    prompt: "¿Cómo tributan los intereses que te paga un depósito a plazo?",
    options: [
      "Están exentos por ser un producto bancario",
      "El interés real ganado es renta y se suma a tu Global Complementario del año",
      "Pagan IVA al vencimiento",
      "Tributan solo si el depósito dura más de un año",
    ],
    correctIndex: 1,
    explanation:
      "El mayor valor de un depósito a plazo es renta afecta: se declara y tributa con el Global Complementario del año. El banco informa la operación al SII, así que aparece en la propuesta de declaración.",
  },
  {
    id: "imp-06",
    topic: "tributacion-inversiones",
    difficulty: "advanced",
    prompt:
      "¿Qué establece el artículo 107 de la Ley de la Renta para ciertas acciones y ETFs chilenos?",
    options: [
      "Que toda ganancia de capital en bolsa está siempre exenta",
      "Que la ganancia de capital puede quedar exenta si el instrumento tiene presencia bursátil y se cumplen los requisitos de compra y venta",
      "Que las acciones pagan una tasa fija del 10%",
      "Que los dividendos no pagan impuesto",
    ],
    correctIndex: 1,
    explanation:
      "El artículo 107 exime la ganancia de capital solo si se cumplen requisitos (presencia bursátil y forma de adquisición/enajenación). No es una exención automática para todo lo que se transe en bolsa.",
  },
  {
    id: "iv-17",
    topic: "tributacion-inversiones",
    difficulty: "advanced",
    prompt:
      "Recibes dividendos de una sociedad anónima chilena. ¿Cómo se reflejan en tu declaración de renta?",
    options: [
      "No se declaran: la empresa ya pagó impuestos por ellos",
      "Se suman a tu renta del Global Complementario, con un crédito por el impuesto de Primera Categoría que ya pagó la empresa",
      "Pagan una tasa fija del 19%, igual que el IVA",
      "Se declaran solo si los reinviertes en la misma empresa",
    ],
    correctIndex: 1,
    explanation:
      "El sistema busca que la utilidad no pague dos veces por completo: el dividendo se incorpora a tu base del Global Complementario y se te reconoce como crédito el impuesto de Primera Categoría enterado por la empresa.",
  },
];

/** Pool completo, en el orden de las categorías. */
export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  ...PERSONAL_FINANCE_QUESTIONS,
  ...INVESTING_QUESTIONS,
];

/** Preguntas disponibles para una categoría. */
export function questionsForCategory(category: DiagnosticCategory): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((q) => questionCategory(q) === category);
}

// -----------------------------------------------------------------------------
// Selección dinámica de preguntas
// -----------------------------------------------------------------------------

/**
 * Reparto de dificultad del test. Es lo que hace comparable el porcentaje de
 * aciertos entre las tres profundidades: un 80% en el test rápido y un 80% en el
 * profundo describen más o menos al mismo estudiante, porque la mezcla de
 * preguntas fáciles y difíciles es la misma proporción.
 */
const DIFFICULTY_MIX: Record<DiagnosticDifficulty, number> = {
  basic: 0.4,
  intermediate: 0.35,
  advanced: 0.25,
};

/** Cuántas preguntas de cada dificultad lleva un test de `total` preguntas. */
function difficultyQuota(total: number): Record<DiagnosticDifficulty, number> {
  const basic = Math.max(1, Math.round(total * DIFFICULTY_MIX.basic));
  const advanced = Math.max(1, Math.round(total * DIFFICULTY_MIX.advanced));
  return { basic, advanced, intermediate: Math.max(0, total - basic - advanced) };
}

/** Copia barajada (Fisher–Yates). No muta la entrada. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Toma `count` preguntas rotando entre temas, para que un test corto de Finanzas
 * Personales no salga entero de presupuesto ni uno de Inversiones entero de APV.
 * Si un tema se agota, sigue con los demás.
 */
function pickSpreadByTopic(pool: DiagnosticQuestion[], count: number): DiagnosticQuestion[] {
  const byTopic = new Map<DiagnosticTopic, DiagnosticQuestion[]>();
  for (const question of shuffle(pool)) {
    const bucket = byTopic.get(question.topic);
    if (bucket) bucket.push(question);
    else byTopic.set(question.topic, [question]);
  }

  const queues = shuffle([...byTopic.values()]);
  const picked: DiagnosticQuestion[] = [];
  while (picked.length < count) {
    const before = picked.length;
    for (const queue of queues) {
      if (picked.length >= count) break;
      const next = queue.shift();
      if (next) picked.push(next);
    }
    // Ninguna cola tenía preguntas: el pool se agotó antes de llegar a `count`.
    if (picked.length === before) break;
  }
  return picked;
}

const DIFFICULTY_ORDER: DiagnosticDifficulty[] = ["basic", "intermediate", "advanced"];

/**
 * Arma el test de UNA categoría para la profundidad elegida: respeta el reparto
 * de dificultad, reparte entre los temas de esa categoría y ordena de menor a
 * mayor dificultad (empezar por lo fácil evita que alguien abandone en la
 * primera pregunta).
 *
 * Se llama en el navegador al pulsar "Comenzar", así que cada intento sortea
 * preguntas distintas. La corrección no depende de esto: el servidor recalcula
 * el puntaje a partir de los ids y deduce la categoría del tema de cada pregunta.
 */
export function selectDiagnosticQuestions(
  depth: DiagnosticDepth,
  category: DiagnosticCategory,
): DiagnosticQuestion[] {
  const total = getDepthOption(depth).questionCount;
  const quota = difficultyQuota(total);
  const categoryPool = questionsForCategory(category);

  const picked: DiagnosticQuestion[] = [];
  for (const difficulty of DIFFICULTY_ORDER) {
    const pool = categoryPool.filter((q) => q.difficulty === difficulty);
    picked.push(...pickSpreadByTopic(pool, quota[difficulty]));
  }

  // Red de seguridad: si alguna dificultad tenía menos preguntas de las pedidas,
  // completamos con lo que quede DE LA MISMA CATEGORÍA para no entregar un test
  // más corto de lo anunciado (el usuario eligió "10 preguntas", no "hasta 10")
  // ni colar preguntas de la otra categoría, que falsearían su nivel.
  if (picked.length < total) {
    const used = new Set(picked.map((q) => q.id));
    const rest = categoryPool.filter((q) => !used.has(q.id));
    picked.push(...pickSpreadByTopic(rest, total - picked.length));
  }

  return picked
    .slice(0, total)
    .sort(
      (a, b) =>
        DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
    );
}

/** Un bloque del intento: las preguntas de una categoría, en su orden. */
export interface DiagnosticBlock {
  category: DiagnosticCategory;
  questions: DiagnosticQuestion[];
}

/**
 * Arma el intento completo: un bloque por categoría del alcance elegido. Con
 * "Ambas" se responden seguidos, pero cada bloque se corrige por separado.
 */
export function selectDiagnosticTest(
  depth: DiagnosticDepth,
  scope: DiagnosticScope,
): DiagnosticBlock[] {
  return categoriesForScope(scope).map((category) => ({
    category,
    questions: selectDiagnosticQuestions(depth, category),
  }));
}

/** Busca una pregunta por id (lo usa el servidor al corregir). */
export function getDiagnosticQuestion(id: string): DiagnosticQuestion | null {
  return DIAGNOSTIC_QUESTIONS.find((q) => q.id === id) ?? null;
}

// -----------------------------------------------------------------------------
// Puntuación y nivel
// -----------------------------------------------------------------------------

/**
 * Umbrales de aciertos (%) para asignar el nivel DE UNA CATEGORÍA.
 *
 * Como la mezcla de dificultad es fija, el porcentaje de aciertos se puede leer
 * directo: fallar casi todas las intermedias deja por debajo de 40.
 *
 * El denominador son SIEMPRE las preguntas del test, no las respondidas: omitir
 * suma cero igual que errar. Solo la certeza positiva convalida lecciones, que
 * es justamente lo que hace seguro ofrecer el "No lo sé" (ver `SKIPPED_ANSWER`).
 */
export const LEVEL_THRESHOLDS = { advanced: 75, intermediate: 40 } as const;

export function levelForAccuracy(accuracy: number): FinancialLevel {
  if (accuracy >= LEVEL_THRESHOLDS.advanced) return "advanced";
  if (accuracy >= LEVEL_THRESHOLDS.intermediate) return "intermediate";
  return "beginner";
}

export const LEVEL_LABELS: Record<FinancialLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Orden de los niveles, de menor a mayor. */
export const LEVEL_ORDER: FinancialLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * Nivel global del estudiante a partir de sus niveles por categoría.
 *
 * El tutor conversa con UNA sola voz (`profiles.financial_level`), así que hay
 * que resumir las dos competencias en una. Se usa el promedio redondeado y no el
 * máximo: a quien es Avanzado invirtiendo pero Principiante en presupuesto no le
 * sirve que el tutor le hable como experto de todo, ni tampoco como novato.
 */
export function combineLevels(levels: FinancialLevel[]): FinancialLevel {
  const known = levels.filter((level): level is FinancialLevel => Boolean(level));
  if (known.length === 0) return "beginner";
  const average =
    known.reduce((sum, level) => sum + LEVEL_ORDER.indexOf(level), 0) / known.length;
  return LEVEL_ORDER[Math.round(average)];
}

export interface LevelSummary {
  emoji: string;
  headline: string;
  detail: string;
}

/**
 * Texto de resultado por categoría y nivel: qué significa y por dónde seguir.
 * Está separado por categoría porque el consejo no es el mismo: a un principiante
 * en Inversiones no se le habla de fondo de emergencia, sino de qué es un ETF.
 */
export const LEVEL_SUMMARY: Record<DiagnosticCategory, Record<FinancialLevel, LevelSummary>> = {
  "Finanzas Personales": {
    beginner: {
      emoji: "🌱",
      headline: "Estás construyendo tus cimientos",
      detail:
        "Partiremos por lo esencial: presupuesto, fondo de emergencia y cómo funciona el interés en tus deudas. El tutor te explicará todo con analogías del día a día y sin jerga.",
    },
    intermediate: {
      emoji: "📊",
      headline: "Ya manejas las bases de tu economía",
      detail:
        "Tienes claro el presupuesto y el ahorro, así que iremos a la práctica: comparar créditos por CAE, ordenar deudas, automatizar el ahorro y sacarle partido a la declaración de renta.",
    },
    advanced: {
      emoji: "🏦",
      headline: "Tu economía personal está bajo control",
      detail:
        "El tutor irá directo al fondo: costo real del crédito, decisiones en UF frente a pesos, planificación tributaria personal y proteger el patrimonio. Menos definiciones, más criterio.",
    },
  },
  Inversiones: {
    beginner: {
      emoji: "🌱",
      headline: "Estás partiendo en el mundo de las inversiones",
      detail:
        "Empezaremos por lo primero: qué es una acción, un ETF y un depósito a plazo, y por qué riesgo y rentabilidad van siempre de la mano. Sin tecnicismos y con ejemplos del mercado chileno.",
    },
    intermediate: {
      emoji: "📈",
      headline: "Ya conoces los instrumentos",
      detail:
        "Sabes qué es cada cosa, así que iremos a las decisiones: armar una cartera diversificada, elegir entre fondos y ETFs por costo, y entender el APV y sus dos regímenes.",
    },
    advanced: {
      emoji: "🚀",
      headline: "Dominas los conceptos de inversión",
      detail:
        "El tutor irá al detalle que mueve la aguja: costos y su efecto compuesto, duración en renta fija, exposición cambiaria y eficiencia tributaria (Art. 107 LIR, dividendos, retiros de APV).",
    },
  },
};
