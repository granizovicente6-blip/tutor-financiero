// =============================================================================
// Test de Diagnóstico de entrada — pool de preguntas y reglas de puntuación
//
// Sustituye a la antigua selección manual de "Nivel de conocimiento": en vez de
// preguntarle al estudiante qué nivel cree tener (poco fiable, y una decisión
// que aún no sabe tomar), se lo medimos con un test corto y le asignamos el
// nivel que usa el tutor para adaptar sus explicaciones.
//
// Igual que el currículum, el contenido vive en código: son preguntas que
// cambian poco, y así quedan versionadas, tipadas y sin migraciones por cada
// ajuste de texto. La BD solo guarda el resultado (`profiles.financial_level`).
//
// El pool es la ÚNICA fuente de verdad de las respuestas correctas: el cliente
// manda los ids elegidos y el servidor recalcula el puntaje contra este archivo
// (ver `saveDiagnosticResult` en `app/profile/actions.ts`). Así el navegador no
// puede regalarse un nivel avanzado.
// =============================================================================

import type { FinancialLevel } from "@/lib/types";

/** Ruta de la pantalla del test (la usan los CTA y el onboarding). */
export const DIAGNOSTIC_PATH = "/diagnostico";

// -----------------------------------------------------------------------------
// Profundidad del test
// -----------------------------------------------------------------------------

/** Las tres profundidades que puede elegir el estudiante antes de empezar. */
export type DiagnosticDepth = "quick" | "recommended" | "deep";

export interface DiagnosticDepthOption {
  key: DiagnosticDepth;
  emoji: string;
  label: string;
  /** Cuántas preguntas se sortean del pool. */
  questionCount: number;
  /** Duración estimada, en minutos (para "~2 min"). */
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
    description: "Cubre los cuatro temas a fondo. Ideal si ya manejas conceptos financieros.",
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

// -----------------------------------------------------------------------------
// Preguntas
// -----------------------------------------------------------------------------

/** Áreas que cubre el diagnóstico. El test siempre reparte entre las cuatro. */
export const DIAGNOSTIC_TOPICS = [
  "presupuesto",
  "interes-compuesto",
  "inversiones-chile",
  "impuestos-chile",
] as const;

export type DiagnosticTopic = (typeof DIAGNOSTIC_TOPICS)[number];

export const TOPIC_LABELS: Record<DiagnosticTopic, string> = {
  presupuesto: "Presupuesto y deuda",
  "interes-compuesto": "Interés compuesto",
  "inversiones-chile": "Inversiones en Chile",
  "impuestos-chile": "Impuestos y unidades",
};

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

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // ---------------------------------------------------------------------------
  // Presupuesto y deuda
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
    id: "pre-02",
    topic: "presupuesto",
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
    id: "pre-05",
    topic: "presupuesto",
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
    id: "pre-06",
    topic: "presupuesto",
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
    id: "pre-07",
    topic: "presupuesto",
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
  // Inversiones en Chile
  // ---------------------------------------------------------------------------
  {
    id: "inv-01",
    topic: "inversiones-chile",
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
    id: "inv-02",
    topic: "inversiones-chile",
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
    id: "inv-03",
    topic: "inversiones-chile",
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
    topic: "inversiones-chile",
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
    id: "inv-05",
    topic: "inversiones-chile",
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
    id: "inv-06",
    topic: "inversiones-chile",
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
    id: "inv-07",
    topic: "inversiones-chile",
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
  // Impuestos y unidades de cuenta (Chile)
  // ---------------------------------------------------------------------------
  {
    id: "imp-01",
    topic: "impuestos-chile",
    difficulty: "basic",
    prompt: "¿Cuál es la tasa general del IVA en Chile?",
    options: ["10%", "19%", "21%", "25%"],
    correctIndex: 1,
    explanation:
      "El IVA general en Chile es 19% y ya viene incluido en el precio que ves en la boleta.",
  },
  {
    id: "imp-02",
    topic: "impuestos-chile",
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
    topic: "impuestos-chile",
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
    topic: "impuestos-chile",
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
    id: "imp-05",
    topic: "impuestos-chile",
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
    id: "imp-06",
    topic: "impuestos-chile",
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
    id: "imp-07",
    topic: "impuestos-chile",
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
];

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
 * Toma `count` preguntas rotando entre temas, para que un test corto no salga
 * entero de presupuesto. Si un tema se agota, sigue con los demás.
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
 * Arma el test para la profundidad elegida: respeta el reparto de dificultad,
 * reparte entre los cuatro temas y ordena de menor a mayor dificultad (empezar
 * por lo fácil evita que alguien abandone en la primera pregunta).
 *
 * Se llama en el navegador al pulsar "Comenzar", así que cada intento sortea
 * preguntas distintas. La corrección no depende de esto: el servidor recalcula
 * el puntaje a partir de los ids.
 */
export function selectDiagnosticQuestions(depth: DiagnosticDepth): DiagnosticQuestion[] {
  const total = getDepthOption(depth).questionCount;
  const quota = difficultyQuota(total);

  const picked: DiagnosticQuestion[] = [];
  for (const difficulty of DIFFICULTY_ORDER) {
    const pool = DIAGNOSTIC_QUESTIONS.filter((q) => q.difficulty === difficulty);
    picked.push(...pickSpreadByTopic(pool, quota[difficulty]));
  }

  // Red de seguridad: si alguna dificultad tenía menos preguntas de las pedidas,
  // completamos con lo que quede para no entregar un test más corto de lo
  // anunciado (el usuario eligió "10 preguntas", no "hasta 10").
  if (picked.length < total) {
    const used = new Set(picked.map((q) => q.id));
    const rest = DIAGNOSTIC_QUESTIONS.filter((q) => !used.has(q.id));
    picked.push(...pickSpreadByTopic(rest, total - picked.length));
  }

  return picked
    .slice(0, total)
    .sort(
      (a, b) =>
        DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
    );
}

/** Busca una pregunta por id (lo usa el servidor al corregir). */
export function getDiagnosticQuestion(id: string): DiagnosticQuestion | null {
  return DIAGNOSTIC_QUESTIONS.find((q) => q.id === id) ?? null;
}

// -----------------------------------------------------------------------------
// Puntuación y nivel
// -----------------------------------------------------------------------------

/**
 * Umbrales de aciertos (%) para asignar el nivel.
 *
 * Como la mezcla de dificultad es fija, el porcentaje de aciertos se puede leer
 * directo: fallar casi todas las intermedias deja por debajo de 40.
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

/** Texto de resultado por nivel: qué significa y por dónde seguir. */
export const LEVEL_SUMMARY: Record<FinancialLevel, { emoji: string; headline: string; detail: string }> = {
  beginner: {
    emoji: "🌱",
    headline: "Estás construyendo tus cimientos",
    detail:
      "Partiremos por lo esencial: presupuesto, fondo de emergencia y cómo funciona el interés compuesto. El tutor te explicará todo con analogías del día a día y sin jerga.",
  },
  intermediate: {
    emoji: "📈",
    headline: "Ya manejas las bases",
    detail:
      "Tienes claros los fundamentos, así que iremos a la práctica: diversificación, instrumentos disponibles en Chile (APV, fondos, ETFs) y decisiones con impuestos de por medio.",
  },
  advanced: {
    emoji: "🚀",
    headline: "Dominas los conceptos clave",
    detail:
      "El tutor irá directo al fondo: costos y su efecto compuesto, eficiencia tributaria, construcción de cartera y gestión de riesgo. Menos definiciones, más criterio.",
  },
};
