// =============================================================================
// Catálogo de instrumentos financieros — contenido estático (Fase 8)
//
// Misma decisión de arquitectura que el currículum (`lib/curriculum.ts`): el
// CONTENIDO vive en código, versionado y con seguridad de tipos. Aquí no hay
// nada del usuario, así que no toca la base de datos en absoluto.
//
// IMPORTANTE: este catálogo es material DIDÁCTICO. Las descripciones explican
// qué sigue cada instrumento (dato estructural y estable), nunca su desempeño
// ni si conviene comprarlo. No hay precios ni rentabilidades: la plataforma no
// consume datos de mercado en vivo y prometer cifras sería, además de falso,
// una recomendación encubierta.
// =============================================================================

/** Familias temáticas bajo las que se agrupa el catálogo en la interfaz. */
export const INSTRUMENT_CATEGORIES = [
  "Índice General",
  "Tecnología",
  "Inteligencia Artificial",
  "Semiconductores",
  "Energía Limpia",
  "Consumo",
  "Salud",
  "Servicios Financieros",
  "Dividendos",
  "Renta Fija",
  "Mercados Emergentes",
  "Materias Primas",
] as const;

/** Categoría temática de un instrumento. */
export type InstrumentCategory = (typeof INSTRUMENT_CATEGORIES)[number];

/**
 * Nivel de riesgo, entendido como VOLATILIDAD ESPERADA y concentración, no como
 * probabilidad de perder dinero. Es una etiqueta pedagógica para ordenar el
 * catálogo de menos a más disperso, no una calificación de una agencia.
 */
export type RiskLevel = "bajo" | "moderado" | "alto" | "muy alto";

/** Un ETF (canasta de activos) o una acción individual (una sola empresa). */
export type InstrumentKind = "ETF" | "Acción";

/** Un instrumento del catálogo. */
export interface Instrument {
  /** Símbolo bursátil. Es el identificador estable (clave del catálogo). */
  ticker: string;
  name: string;
  kind: InstrumentKind;
  category: InstrumentCategory;
  risk: RiskLevel;
  /** Emblema visual de la tarjeta (emoji). */
  emblem: string;
  /** Qué sigue o a qué se dedica, en una o dos frases. */
  description: string;
  /** Gestora del fondo o sector de la empresa, como contexto. */
  issuer: string;
}

// ---------------------------------------------------------------------------
// El catálogo
// ---------------------------------------------------------------------------

export const INSTRUMENTS: Instrument[] = [
  // --- Índices generales: la base de cualquier conversación sobre inversión.
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    kind: "ETF",
    category: "Índice General",
    risk: "moderado",
    emblem: "🏛️",
    description:
      "Replica el índice S&P 500, formado por unas 500 de las mayores empresas cotizadas de Estados Unidos. Es el ejemplo clásico para explicar qué significa diversificar.",
    issuer: "Vanguard",
  },
  {
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    kind: "ETF",
    category: "Índice General",
    risk: "moderado",
    emblem: "🇺🇸",
    description:
      "Sigue prácticamente todo el mercado accionario estadounidense: grandes, medianas y pequeñas empresas en un solo instrumento.",
    issuer: "Vanguard",
  },
  {
    ticker: "VT",
    name: "Vanguard Total World Stock ETF",
    kind: "ETF",
    category: "Índice General",
    risk: "moderado",
    emblem: "🌍",
    description:
      "Reúne acciones de mercados desarrollados y emergentes de todo el mundo. Útil para entender el concepto de diversificación geográfica.",
    issuer: "Vanguard",
  },
  {
    ticker: "IVV",
    name: "iShares Core S&P 500 ETF",
    kind: "ETF",
    category: "Índice General",
    risk: "moderado",
    emblem: "📊",
    description:
      "Otro fondo que sigue el S&P 500, de una gestora distinta. Sirve para comparar dos productos casi idénticos y ver qué los diferencia (costos, tamaño, liquidez).",
    issuer: "BlackRock / iShares",
  },

  // --- Tecnología.
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    kind: "ETF",
    category: "Tecnología",
    risk: "alto",
    emblem: "💻",
    description:
      "Replica el Nasdaq-100: las mayores empresas no financieras del Nasdaq, con fuerte peso tecnológico. Concentra más que un índice general.",
    issuer: "Invesco",
  },
  {
    ticker: "VGT",
    name: "Vanguard Information Technology ETF",
    kind: "ETF",
    category: "Tecnología",
    risk: "alto",
    emblem: "🖥️",
    description:
      "Agrupa empresas del sector tecnología de Estados Unidos: software, hardware y servicios informáticos.",
    issuer: "Vanguard",
  },
  {
    ticker: "XLK",
    name: "Technology Select Sector SPDR Fund",
    kind: "ETF",
    category: "Tecnología",
    risk: "alto",
    emblem: "⚙️",
    description:
      "Toma solo las empresas tecnológicas que ya forman parte del S&P 500. Buen ejemplo de un ETF sectorial dentro de un índice mayor.",
    issuer: "State Street / SPDR",
  },

  // --- Inteligencia artificial (temáticos).
  {
    ticker: "AIQ",
    name: "Global X Artificial Intelligence & Technology ETF",
    kind: "ETF",
    category: "Inteligencia Artificial",
    risk: "alto",
    emblem: "🤖",
    description:
      "ETF temático que reúne empresas vinculadas al desarrollo y uso de inteligencia artificial y big data.",
    issuer: "Global X",
  },
  {
    ticker: "BOTZ",
    name: "Global X Robotics & Artificial Intelligence ETF",
    kind: "ETF",
    category: "Inteligencia Artificial",
    risk: "alto",
    emblem: "🦾",
    description:
      "Se enfoca en robótica y automatización industrial además de IA. Cartera más concentrada que un ETF sectorial amplio.",
    issuer: "Global X",
  },
  {
    ticker: "ARKQ",
    name: "ARK Autonomous Technology & Robotics ETF",
    kind: "ETF",
    category: "Inteligencia Artificial",
    risk: "muy alto",
    emblem: "🚀",
    description:
      "Fondo de gestión activa centrado en autonomía y robótica: el gestor elige las empresas en vez de seguir un índice.",
    issuer: "ARK Invest",
  },

  // --- Semiconductores.
  {
    ticker: "SMH",
    name: "VanEck Semiconductor ETF",
    kind: "ETF",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "🔌",
    description:
      "Reúne a las principales empresas de semiconductores del mundo. Es un sector cíclico: se mueve con fuerza en ambos sentidos.",
    issuer: "VanEck",
  },
  {
    ticker: "SOXX",
    name: "iShares Semiconductor ETF",
    kind: "ETF",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "🧩",
    description:
      "Sigue un índice de fabricantes y diseñadores de chips cotizados en Estados Unidos.",
    issuer: "BlackRock / iShares",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    kind: "Acción",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "🎮",
    description:
      "Acción individual de una empresa de diseño de chips gráficos y aceleradores para centros de datos. Sirve para contrastar una sola empresa frente a una canasta.",
    issuer: "Sector semiconductores",
  },

  // --- Energía limpia.
  {
    ticker: "ICLN",
    name: "iShares Global Clean Energy ETF",
    kind: "ETF",
    category: "Energía Limpia",
    risk: "muy alto",
    emblem: "🌱",
    description:
      "Empresas globales de energías renovables: generación, equipamiento y tecnología asociada.",
    issuer: "BlackRock / iShares",
  },
  {
    ticker: "PBW",
    name: "Invesco WilderHill Clean Energy ETF",
    kind: "ETF",
    category: "Energía Limpia",
    risk: "muy alto",
    emblem: "♻️",
    description:
      "ETF temático de energía limpia con fuerte presencia de empresas pequeñas, lo que aumenta su volatilidad.",
    issuer: "Invesco",
  },
  {
    ticker: "TAN",
    name: "Invesco Solar ETF",
    kind: "ETF",
    category: "Energía Limpia",
    risk: "muy alto",
    emblem: "☀️",
    description:
      "Centrado exclusivamente en la industria solar a nivel mundial. Ejemplo extremo de concentración temática.",
    issuer: "Invesco",
  },

  // --- Dividendos.
  {
    ticker: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    kind: "ETF",
    category: "Dividendos",
    risk: "moderado",
    emblem: "💵",
    description:
      "Selecciona empresas estadounidenses con historial de pago de dividendos y ciertos filtros de calidad financiera.",
    issuer: "Charles Schwab",
  },
  {
    ticker: "VYM",
    name: "Vanguard High Dividend Yield ETF",
    kind: "ETF",
    category: "Dividendos",
    risk: "moderado",
    emblem: "🏦",
    description:
      "Agrupa acciones con dividendos por sobre el promedio del mercado. Útil para explicar la diferencia entre flujo y apreciación.",
    issuer: "Vanguard",
  },

  // --- Renta fija.
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    kind: "ETF",
    category: "Renta Fija",
    risk: "bajo",
    emblem: "📄",
    description:
      "Canasta amplia de bonos estadounidenses de grado de inversión. Se usa como ejemplo del rol estabilizador de la renta fija.",
    issuer: "Vanguard",
  },
  {
    ticker: "TLT",
    name: "iShares 20+ Year Treasury Bond ETF",
    kind: "ETF",
    category: "Renta Fija",
    risk: "alto",
    emblem: "🏛",
    description:
      "Bonos del Tesoro de Estados Unidos a más de 20 años. Aunque el emisor es muy sólido, el plazo largo lo hace sensible a las tasas de interés.",
    issuer: "BlackRock / iShares",
  },

  // --- Mercados emergentes.
  {
    ticker: "VWO",
    name: "Vanguard FTSE Emerging Markets ETF",
    kind: "ETF",
    category: "Mercados Emergentes",
    risk: "alto",
    emblem: "🌏",
    description:
      "Acciones de economías emergentes como China, India, Brasil o Taiwán. Introduce riesgo cambiario y político al análisis.",
    issuer: "Vanguard",
  },
  {
    ticker: "ECH",
    name: "iShares MSCI Chile ETF",
    kind: "ETF",
    category: "Mercados Emergentes",
    risk: "muy alto",
    emblem: "🇨🇱",
    description:
      "Sigue a las principales empresas cotizadas en Chile. Permite discutir qué implica concentrar la inversión en un solo país.",
    issuer: "BlackRock / iShares",
  },

  // --- Materias primas.
  {
    ticker: "GLD",
    name: "SPDR Gold Shares",
    kind: "ETF",
    category: "Materias Primas",
    risk: "moderado",
    emblem: "🥇",
    description:
      "Sigue el precio del oro físico. No genera intereses ni dividendos: su comportamiento depende solo del precio del metal.",
    issuer: "State Street / SPDR",
  },

  // ===========================================================================
  // Acciones individuales
  //
  // Una acción es UNA empresa, no una canasta: por eso todas aparecen aquí con
  // un riesgo igual o mayor que el del ETF de su misma categoría. Están para
  // que el estudiante pueda contrastar ambas cosas sobre el mismo sector, que
  // es la lección central de esta sección.
  // ===========================================================================

  // --- Tecnología.
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    kind: "Acción",
    category: "Tecnología",
    risk: "alto",
    emblem: "🍎",
    description:
      "Diseña y vende hardware de consumo (iPhone, Mac) y una creciente línea de servicios digitales asociados a su ecosistema.",
    issuer: "Sector tecnología",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    kind: "Acción",
    category: "Tecnología",
    risk: "alto",
    emblem: "🪟",
    description:
      "Software empresarial, sistema operativo Windows y la nube Azure. Su negocio combina licencias y suscripciones recurrentes.",
    issuer: "Sector tecnología",
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc. (Clase A)",
    kind: "Acción",
    category: "Tecnología",
    risk: "alto",
    emblem: "🔎",
    description:
      "Matriz de Google y YouTube. Su ingreso depende sobre todo de la publicidad digital, lo que la hace sensible al ciclo económico.",
    issuer: "Sector tecnología",
  },
  {
    ticker: "AMZN",
    name: "Amazon.com, Inc.",
    kind: "Acción",
    category: "Tecnología",
    risk: "alto",
    emblem: "📦",
    description:
      "Comercio electrónico a gran escala más AWS, su división de servicios en la nube. Buen ejemplo de una empresa con dos negocios muy distintos.",
    issuer: "Sector tecnología / consumo",
  },
  {
    ticker: "META",
    name: "Meta Platforms, Inc.",
    kind: "Acción",
    category: "Tecnología",
    risk: "muy alto",
    emblem: "💬",
    description:
      "Dueña de Facebook, Instagram y WhatsApp. Vive de la publicidad y a la vez invierte fuerte en apuestas de largo plazo.",
    issuer: "Sector tecnología",
  },

  // --- Semiconductores (además de NVDA, más arriba).
  {
    ticker: "AVGO",
    name: "Broadcom Inc.",
    kind: "Acción",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "📡",
    description:
      "Chips de conectividad y redes, más una división de software empresarial construida a base de adquisiciones.",
    issuer: "Sector semiconductores",
  },
  {
    ticker: "AMD",
    name: "Advanced Micro Devices, Inc.",
    kind: "Acción",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "⚡",
    description:
      "Diseña procesadores y tarjetas gráficas que compiten directamente con Intel y NVIDIA. Sector muy cíclico.",
    issuer: "Sector semiconductores",
  },
  {
    ticker: "TSM",
    name: "Taiwan Semiconductor Manufacturing",
    kind: "Acción",
    category: "Semiconductores",
    risk: "muy alto",
    emblem: "🏭",
    description:
      "Fabrica por encargo los chips que otras empresas diseñan. Añade al análisis el factor geopolítico de su ubicación.",
    issuer: "Sector semiconductores",
  },

  // --- Energía limpia.
  {
    ticker: "TSLA",
    name: "Tesla, Inc.",
    kind: "Acción",
    category: "Energía Limpia",
    risk: "muy alto",
    emblem: "🔋",
    description:
      "Vehículos eléctricos, baterías y almacenamiento de energía. Históricamente una de las acciones grandes más volátiles del mercado.",
    issuer: "Sector automotriz / energía",
  },

  // --- Consumo.
  {
    ticker: "KO",
    name: "The Coca-Cola Company",
    kind: "Acción",
    category: "Consumo",
    risk: "moderado",
    emblem: "🥤",
    description:
      "Bebidas de consumo masivo con demanda estable. Es el ejemplo clásico de empresa defensiva que reparte dividendos.",
    issuer: "Consumo básico",
  },
  {
    ticker: "NFLX",
    name: "Netflix, Inc.",
    kind: "Acción",
    category: "Consumo",
    risk: "muy alto",
    emblem: "🎬",
    description:
      "Suscripciones de streaming a nivel global. Su valoración depende mucho del crecimiento esperado de suscriptores.",
    issuer: "Consumo discrecional",
  },

  // --- Salud.
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    kind: "Acción",
    category: "Salud",
    risk: "moderado",
    emblem: "💊",
    description:
      "Farmacéutica y productos médicos. Otro ejemplo de sector defensivo: la demanda de salud no sigue el ciclo económico.",
    issuer: "Sector salud",
  },

  // --- Servicios financieros.
  {
    ticker: "JPM",
    name: "JPMorgan Chase & Co.",
    kind: "Acción",
    category: "Servicios Financieros",
    risk: "alto",
    emblem: "🏦",
    description:
      "El mayor banco de Estados Unidos. Su resultado depende de las tasas de interés y de la salud del crédito.",
    issuer: "Banca",
  },
  {
    ticker: "V",
    name: "Visa Inc.",
    kind: "Acción",
    category: "Servicios Financieros",
    risk: "alto",
    emblem: "💳",
    description:
      "Opera la red que procesa pagos con tarjeta. No presta dinero: cobra una comisión por cada transacción que pasa por su red.",
    issuer: "Medios de pago",
  },
];

// ---------------------------------------------------------------------------
// Identidad visual
//
// Las clases de Tailwind se guardan COMPLETAS (nunca interpoladas) para que el
// compilador las detecte, igual que en `components/Dashboard.tsx`.
// ---------------------------------------------------------------------------

/** Etiqueta y estilo del distintivo de riesgo. */
export const RISK_META: Record<RiskLevel, { label: string; badge: string; dot: string }> = {
  bajo: {
    label: "Riesgo bajo",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  moderado: {
    label: "Riesgo moderado",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
  },
  alto: {
    label: "Riesgo alto",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  "muy alto": {
    label: "Riesgo muy alto",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
};

/** Emoji y estilo de cada categoría (pestañas de filtro y chips de tarjeta). */
export const INSTRUMENT_CATEGORY_META: Record<
  InstrumentCategory,
  { emoji: string; chip: string }
> = {
  "Índice General": { emoji: "🏛️", chip: "bg-slate-100 text-slate-700" },
  Tecnología: { emoji: "💻", chip: "bg-indigo-100 text-indigo-800" },
  "Inteligencia Artificial": { emoji: "🤖", chip: "bg-violet-100 text-violet-800" },
  Semiconductores: { emoji: "🔌", chip: "bg-cyan-100 text-cyan-800" },
  "Energía Limpia": { emoji: "🌱", chip: "bg-lime-100 text-lime-800" },
  Consumo: { emoji: "🛒", chip: "bg-rose-100 text-rose-800" },
  Salud: { emoji: "🩺", chip: "bg-teal-100 text-teal-800" },
  "Servicios Financieros": { emoji: "💳", chip: "bg-fuchsia-100 text-fuchsia-800" },
  Dividendos: { emoji: "💵", chip: "bg-emerald-100 text-emerald-800" },
  "Renta Fija": { emoji: "📄", chip: "bg-blue-100 text-blue-800" },
  "Mercados Emergentes": { emoji: "🌏", chip: "bg-orange-100 text-orange-800" },
  "Materias Primas": { emoji: "🥇", chip: "bg-yellow-100 text-yellow-800" },
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Busca un instrumento por su símbolo (sin distinguir mayúsculas).
 *
 * Es además la VALIDACIÓN del ticker que llega por la API: solo se analiza lo
 * que está en el catálogo, de modo que nadie pueda usar el endpoint de IA como
 * un generador de texto libre.
 */
export function getInstrumentByTicker(ticker: string): Instrument | null {
  const normalized = ticker.trim().toUpperCase();
  return INSTRUMENTS.find((item) => item.ticker === normalized) ?? null;
}

/** Categorías que realmente aparecen en el catálogo, en el orden canónico. */
export function getUsedCategories(): InstrumentCategory[] {
  const present = new Set(INSTRUMENTS.map((item) => item.category));
  return INSTRUMENT_CATEGORIES.filter((category) => present.has(category));
}

/** Instrumentos de una categoría (o todos, si se omite). */
export function getInstrumentsByCategory(
  category: InstrumentCategory | null,
): Instrument[] {
  if (category === null) return INSTRUMENTS;
  return INSTRUMENTS.filter((item) => item.category === category);
}

/** ETFs o acciones. Es la partición que separan las pestañas de la sección. */
export function getInstrumentsByKind(kind: InstrumentKind): Instrument[] {
  return INSTRUMENTS.filter((item) => item.kind === kind);
}

/** Vocales acentuadas y eñe del español, y su equivalente sin marca. */
const ACCENTED = "áàäâéèëêíìïîóòöôúùüûñ";
const UNACCENTED = "aaaaeeeeiiiioooouuuun";

/**
 * Minúsculas y sin acentos, para que "tecnologia" encuentre "Tecnología" y
 * "indice" encuentre "Índice General".
 *
 * La sustitución es una tabla explícita en vez de una normalización Unicode:
 * el catálogo está entero en español, la tabla cubre todos sus casos y se lee
 * de un vistazo.
 */
function normalizeText(text: string): string {
  let result = "";
  for (const char of text.toLowerCase()) {
    const index = ACCENTED.indexOf(char);
    result += index === -1 ? char : UNACCENTED[index];
  }
  return result;
}

/**
 * Búsqueda del catálogo por símbolo, nombre, categoría o emisor.
 *
 * Busca SOLO dentro del catálogo a propósito: es la misma lista que valida
 * `/api/instruments/analyze`, así que todo lo que el buscador encuentra se
 * puede analizar, y nada de lo que devuelve deja al endpoint de IA sin su
 * validación contra contenido conocido.
 */
export function searchInstruments(pool: Instrument[], query: string): Instrument[] {
  const needle = normalizeText(query.trim());
  if (needle === "") return pool;
  return pool.filter((item) =>
    normalizeText(
      `${item.ticker} ${item.name} ${item.category} ${item.issuer} ${item.kind}`,
    ).includes(needle),
  );
}
