// =============================================================================
// Simulador de portafolio e independencia financiera — dominio Chile (UF).
//
// Funciones puras: sin red, sin BD, sin IA. Todo es determinista y sincrónico,
// igual que `lib/finance.ts`, del que este módulo es el hermano "chileno":
// trabaja en pesos, convierte a UF y conoce las metas y los impuestos locales.
//
// Los porcentajes de rentabilidad son REALES (ya descontada la inflación), que
// es la única forma honesta de proyectar a 40 años en un país indexado: como el
// resultado queda en pesos de hoy, se puede leer en UF sin más ajustes.
//
// Todo lo que sale de aquí son ILUSTRACIONES educativas con los supuestos que
// introduce el usuario: no son proyecciones, ni garantías, ni asesoría.
// =============================================================================

import { clamp } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Unidades chilenas
// ---------------------------------------------------------------------------

/**
 * Valor de referencia de la UF en pesos usado por el simulador.
 *
 * Es una CONSTANTE educativa, no un dato de mercado: la UF real se reajusta a
 * diario con el IPC. Vive aquí para que la conversión sea una sola y se pueda
 * actualizar (o sustituir por una lectura en vivo) en un único sitio.
 */
export const UF_CLP = 38_500;

/**
 * Valor de referencia de la UTM en pesos. Solo se usa para traducir a pesos los
 * tramos del Impuesto Global Complementario, que la ley define en UTM/UTA.
 */
export const UTM_CLP = 68_000;

/** Pasa un monto en pesos a UF (al valor de referencia del simulador). */
export function clpToUf(clp: number): number {
  return clp / UF_CLP;
}

/** Pasa un monto en UF a pesos (al valor de referencia del simulador). */
export function ufToClp(uf: number): number {
  return uf * UF_CLP;
}

// ---------------------------------------------------------------------------
// Límites del simulador
// ---------------------------------------------------------------------------

/** Horizonte máximo para un usuario sin membresía. */
export const FREE_MAX_YEARS = 10;
/** Horizonte máximo con Membresía Premium. */
export const PREMIUM_MAX_YEARS = 40;
/** Techo defensivo para los montos en pesos (evita inputs absurdos). */
const MAX_CLP = 100_000_000_000;

// ---------------------------------------------------------------------------
// Perfiles de riesgo y distribución de cartera
// ---------------------------------------------------------------------------

export type RiskProfileKey = "conservador" | "moderado" | "agresivo";

/** Perfil disponible sin membresía (los otros dos quedan bajo llave). */
export const FREE_RISK_PROFILE: RiskProfileKey = "moderado";

/** Una porción de la cartera de referencia (los pct de un perfil suman 100). */
export interface AllocationSlice {
  label: string;
  /** Peso en la cartera, 0–100. */
  pct: number;
  /** Ejemplos de instrumentos que suelen ocupar ese lugar. */
  examples: string;
  /** Clase Tailwind del color con el que se pinta la porción. */
  colorClass: string;
}

export interface RiskProfile {
  key: RiskProfileKey;
  label: string;
  /** Rentabilidad REAL anual supuesta (ya descontada la inflación), en %. */
  realAnnualRatePct: number;
  /** Frase corta para el selector. */
  summary: string;
  /** Qué se siente al tenerlo: volatilidad esperada, en lenguaje llano. */
  volatility: string;
  /** Cartera de referencia educativa por tipo de activo. */
  allocation: AllocationSlice[];
}

/**
 * Los tres perfiles del simulador.
 *
 * Las carteras son EJEMPLOS DE TEXTO ACADÉMICO por clase de activo (renta fija
 * en UF / bolsa global desarrollada / emergentes y tecnología), del tipo que se
 * usa para explicar la relación riesgo-retorno. No son una recomendación de
 * compra ni están ajustadas a la situación de nadie.
 */
export const RISK_PROFILES: Record<RiskProfileKey, RiskProfile> = {
  conservador: {
    key: "conservador",
    label: "Conservador",
    realAnnualRatePct: 3.5,
    summary: "Priorizas no perder por sobre crecer.",
    volatility: "Caídas poco frecuentes y de un dígito.",
    allocation: [
      {
        label: "Renta fija en UF",
        pct: 65,
        examples: "Depósitos a plazo en UF, fondos mutuos de deuda, bonos de Tesorería",
        colorClass: "bg-sky-500",
      },
      {
        label: "Bolsa global desarrollada",
        pct: 30,
        examples: "ETFs sobre S&P 500 (p. ej. VOO) o mundo desarrollado",
        colorClass: "bg-emerald-500",
      },
      {
        label: "Emergentes y tecnología",
        pct: 5,
        examples: "ETFs de mercados emergentes o sectoriales de tecnología",
        colorClass: "bg-violet-500",
      },
    ],
  },
  moderado: {
    key: "moderado",
    label: "Moderado",
    realAnnualRatePct: 6.5,
    summary: "Aceptas vaivenes a cambio de crecer más.",
    volatility: "Años malos de dos dígitos, recuperables con tiempo.",
    allocation: [
      {
        label: "Renta fija en UF",
        pct: 35,
        examples: "Depósitos a plazo en UF, fondos mutuos de deuda, bonos de Tesorería",
        colorClass: "bg-sky-500",
      },
      {
        label: "Bolsa global desarrollada",
        pct: 50,
        examples: "ETFs sobre S&P 500 (p. ej. VOO) o mundo desarrollado",
        colorClass: "bg-emerald-500",
      },
      {
        label: "Emergentes y tecnología",
        pct: 15,
        examples: "ETFs de mercados emergentes o sectoriales de tecnología",
        colorClass: "bg-violet-500",
      },
    ],
  },
  agresivo: {
    key: "agresivo",
    label: "Agresivo",
    realAnnualRatePct: 9,
    summary: "Buscas el máximo crecimiento a largo plazo.",
    volatility: "Caídas del 30–50% en las crisis; solo con horizonte largo.",
    allocation: [
      {
        label: "Renta fija en UF",
        pct: 10,
        examples: "Depósitos a plazo en UF, fondos mutuos de deuda, bonos de Tesorería",
        colorClass: "bg-sky-500",
      },
      {
        label: "Bolsa global desarrollada",
        pct: 60,
        examples: "ETFs sobre S&P 500 (p. ej. VOO) o mundo desarrollado",
        colorClass: "bg-emerald-500",
      },
      {
        label: "Emergentes y tecnología",
        pct: 30,
        examples: "ETFs de mercados emergentes o sectoriales de tecnología",
        colorClass: "bg-violet-500",
      },
    ],
  },
};

/** Los perfiles en orden de menor a mayor riesgo (para pintar el selector). */
export const RISK_PROFILE_LIST: RiskProfile[] = [
  RISK_PROFILES.conservador,
  RISK_PROFILES.moderado,
  RISK_PROFILES.agresivo,
];

// ---------------------------------------------------------------------------
// Libertad financiera (regla del 4%)
//
// El simulador no pregunta por una meta: la deduce. Todo patrimonio implica una
// renta perpetua, y esa renta es la traducción del número abstracto ("$180
// millones") a la única pregunta que le importa a la persona: ¿de cuánto vivo?
// ---------------------------------------------------------------------------

/**
 * Tasa de retiro seguro de la "regla del 4%": la referencia clásica (estudio
 * Trinity) que estima cuánto se puede retirar al año de una cartera sin
 * agotarla. Es una regla de pulgar discutida, no una ley.
 */
export const SAFE_WITHDRAWAL_RATE = 0.04;

/** Renta mensual perpetua que sostiene un capital, según la regla del 4%. */
export function monthlyIncomeFromCapital(capitalClp: number): number {
  return (Math.max(0, capitalClp) * SAFE_WITHDRAWAL_RATE) / 12;
}

/** El camino inverso: capital necesario para sostener una renta mensual. */
export function capitalForMonthlyIncome(monthlyClp: number): number {
  return (Math.max(0, monthlyClp) * 12) / SAFE_WITHDRAWAL_RATE;
}

/**
 * Renta mensual de referencia para una jubilación holgada, en PESOS DE HOY.
 *
 * Es un umbral educativo, no una cifra oficial: un orden de magnitud de "vivir
 * sin apreturas" en Chile. Como la proyección es real (sobre la inflación), se
 * compara directamente contra pesos de hoy sin reajustar.
 */
export const SOLID_RETIREMENT_INCOME_CLP = 1_000_000;

/**
 * Piso funcional: bajo esta renta mensual la pensión no cubre lo básico, del
 * orden del ingreso mínimo mensual chileno. Misma naturaleza referencial.
 */
export const FUNCTIONAL_MINIMUM_INCOME_CLP = 500_000;

/**
 * Aporte mensual necesario para llegar a `targetClp` en el horizonte dado.
 *
 * Despeja A en la fórmula del valor futuro con aportes a fin de mes:
 *   FV = P·(1+i)^n + A · [((1+i)^n − 1) / i]
 * Devuelve 0 cuando el capital inicial ya alcanza por sí solo.
 */
export function requiredMonthlyContribution(params: {
  targetClp: number;
  initialClp: number;
  years: number;
  realAnnualRatePct: number;
}): number {
  const months = Math.round(clamp(params.years, 1, PREMIUM_MAX_YEARS)) * 12;
  const monthlyRate = Math.pow(1 + clamp(params.realAnnualRatePct, 0, 30) / 100, 1 / 12) - 1;
  const growth = Math.pow(1 + monthlyRate, months);

  const missing = params.targetClp - Math.max(0, params.initialClp) * growth;
  if (missing <= 0) return 0;

  // Con tasa 0 el factor de la anualidad degenera en el número de meses.
  const annuityFactor = monthlyRate === 0 ? months : (growth - 1) / monthlyRate;
  return missing / annuityFactor;
}

/**
 * Cómo de cerca está el plan de sostener a la persona.
 *
 * - `solida`       — la renta proyectada supera la referencia holgada.
 * - `funcional`    — da para vivir, pero sin margen.
 * - `insuficiente` — no llega al piso funcional, o rinde menos al mes de lo que
 *                    la persona está aportando (señal clara de que falta camino).
 */
export type FreedomVerdict = "solida" | "funcional" | "insuficiente";

export interface FreedomAssessment {
  /** Renta mensual perpetua que pagaría el patrimonio final. */
  monthlyIncome: number;
  verdict: FreedomVerdict;
  /** Renta y capital de referencia de una jubilación sólida. */
  solidTargetIncome: number;
  solidTargetCapital: number;
  /** Umbral que se exigió para no caer en `insuficiente`. */
  functionalFloor: number;
  /** Porcentaje de la renta sólida que cubre la proyección (0–100). */
  coveragePct: number;
  /**
   * Aporte mensual que haría falta para llegar a la renta sólida en el mismo
   * horizonte. `null` si el plan actual ya lo consigue.
   */
  suggestedMonthly: number | null;
}

export function assessFinancialFreedom(params: {
  finalBalance: number;
  initialClp: number;
  monthlyContribution: number;
  years: number;
  realAnnualRatePct: number;
}): FreedomAssessment {
  const monthlyIncome = monthlyIncomeFromCapital(params.finalBalance);
  const solidTargetCapital = capitalForMonthlyIncome(SOLID_RETIREMENT_INCOME_CLP);

  // Quien aporta mucho al mes merece una vara más alta: si el patrimonio rinde
  // menos de lo que esa persona ahorra, el plan todavía no la sostiene.
  const functionalFloor = Math.max(
    FUNCTIONAL_MINIMUM_INCOME_CLP,
    Math.max(0, params.monthlyContribution),
  );

  const verdict: FreedomVerdict =
    monthlyIncome >= SOLID_RETIREMENT_INCOME_CLP
      ? "solida"
      : monthlyIncome >= functionalFloor
        ? "funcional"
        : "insuficiente";

  const required = requiredMonthlyContribution({
    targetClp: solidTargetCapital,
    initialClp: params.initialClp,
    years: params.years,
    realAnnualRatePct: params.realAnnualRatePct,
  });

  return {
    monthlyIncome,
    verdict,
    solidTargetIncome: SOLID_RETIREMENT_INCOME_CLP,
    solidTargetCapital,
    functionalFloor,
    coveragePct: Math.min(100, (monthlyIncome / SOLID_RETIREMENT_INCOME_CLP) * 100),
    suggestedMonthly: required <= params.monthlyContribution ? null : required,
  };
}

// ---------------------------------------------------------------------------
// Motor de proyección
// ---------------------------------------------------------------------------

export interface ProjectionInput {
  /** Capital inicial, en CLP. */
  initialClp: number;
  /** Aporte mensual, en CLP. */
  monthlyClp: number;
  /** Horizonte en años (entero ≥ 1). */
  years: number;
  /** Rentabilidad real anual supuesta, en % (7 = 7%). */
  realAnnualRatePct: number;
  /** Capital objetivo en CLP; 0 = sin meta. */
  goalClp: number;
}

/** Foto del portafolio al cierre de un año. */
export interface PortfolioYearPoint {
  year: number;
  /** Patrimonio total acumulado. */
  balance: number;
  /** Capital de bolsillo aportado hasta ese momento (inicial + aportes). */
  contributed: number;
  /** Crecimiento por interés compuesto (balance − contributed). */
  interest: number;
}

export interface ProjectionResult {
  /** Serie anual del horizonte elegido, incluyendo el año 0. */
  series: PortfolioYearPoint[];
  finalBalance: number;
  totalContributed: number;
  totalInterest: number;
  /** Meses hasta tocar la meta; null si no se alcanza ni buscando a 60 años. */
  monthsToGoal: number | null;
  /** True si la meta cae DENTRO del horizonte que eligió el usuario. */
  goalWithinHorizon: boolean;
  /** Avance hacia la meta al final del horizonte, 0–100. */
  goalProgressPct: number;
}

/**
 * Hasta dónde se sigue simulando para responder "¿y cuándo llegaría?" cuando la
 * meta queda fuera del horizonte elegido. No alarga el gráfico: solo la búsqueda.
 */
export const GOAL_SEARCH_YEARS = 60;

/**
 * Proyecta el portafolio MES A MES con interés compuesto y aportes al cierre de
 * cada mes, y devuelve una foto anual para graficar.
 *
 * La tasa mensual se obtiene de forma geométrica —(1 + r)^(1/12) − 1— y no
 * dividiendo entre 12: así el rendimiento acumulado en doce meses es exactamente
 * la tasa anual declarada, sin el sobre-retorno que introduce la división.
 */
export function projectPortfolio(input: ProjectionInput): ProjectionResult {
  const initial = clamp(input.initialClp, 0, MAX_CLP);
  const monthly = clamp(input.monthlyClp, 0, MAX_CLP);
  const years = Math.round(clamp(input.years, 1, PREMIUM_MAX_YEARS));
  const ratePct = clamp(input.realAnnualRatePct, 0, 30);
  const goal = Math.max(0, input.goalClp);

  const monthlyRate = Math.pow(1 + ratePct / 100, 1 / 12) - 1;

  const series: PortfolioYearPoint[] = [
    { year: 0, balance: initial, contributed: initial, interest: 0 },
  ];

  const horizonMonths = years * 12;
  const searchMonths = Math.max(horizonMonths, GOAL_SEARCH_YEARS * 12);

  let balance = initial;
  let contributed = initial;
  // El capital inicial puede cubrir la meta ya en el mes 0.
  let monthsToGoal: number | null = goal > 0 && initial >= goal ? 0 : null;
  let finalBalance = initial;
  let totalContributed = initial;

  for (let month = 1; month <= searchMonths; month++) {
    balance = balance * (1 + monthlyRate) + monthly;
    contributed += monthly;

    if (monthsToGoal === null && goal > 0 && balance >= goal) monthsToGoal = month;

    if (month <= horizonMonths) {
      if (month % 12 === 0) {
        series.push({
          year: month / 12,
          balance,
          contributed,
          interest: balance - contributed,
        });
      }
      finalBalance = balance;
      totalContributed = contributed;
    }

    // Pasado el horizonte solo seguimos para datar la meta: en cuanto la tenemos
    // (o si no hay meta que buscar) no queda nada por calcular.
    if (month >= horizonMonths && (goal <= 0 || monthsToGoal !== null)) break;
  }

  return {
    series,
    finalBalance,
    totalContributed,
    totalInterest: finalBalance - totalContributed,
    monthsToGoal,
    goalWithinHorizon: monthsToGoal !== null && monthsToGoal <= horizonMonths,
    goalProgressPct: goal > 0 ? Math.min(100, (finalBalance / goal) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Escenarios de sensibilidad (Premium)
// ---------------------------------------------------------------------------

export interface Scenario {
  key: "pesimista" | "esperado" | "optimista";
  label: string;
  /** Cuánto se mueve la tasa real respecto del perfil elegido, en puntos. */
  deltaPct: number;
  /** Por qué se muestra ese escenario. */
  note: string;
}

/**
 * Los tres escenarios. Mover la tasa real ±2 puntos no es un cálculo de
 * probabilidad: es una prueba de estrés para ver cuánto depende el resultado de
 * un supuesto que nadie conoce de antemano.
 */
export const SCENARIOS: Scenario[] = [
  {
    key: "pesimista",
    label: "Conservador",
    deltaPct: -2,
    note: "Décadas flojas: la rentabilidad real queda 2 puntos bajo lo supuesto.",
  },
  {
    key: "esperado",
    label: "Esperado",
    deltaPct: 0,
    note: "El supuesto central de tu perfil de riesgo.",
  },
  {
    key: "optimista",
    label: "Optimista",
    deltaPct: 2,
    note: "Viento a favor: la rentabilidad real supera en 2 puntos lo supuesto.",
  },
];

export interface ScenarioResult extends Scenario {
  ratePct: number;
  projection: ProjectionResult;
}

/** Corre la misma proyección con las tres tasas del análisis de sensibilidad. */
export function buildScenarios(input: ProjectionInput): ScenarioResult[] {
  return SCENARIOS.map((scenario) => {
    // Piso de 0,5%: por debajo el "escenario malo" deja de ser informativo y se
    // convierte en una cuenta de ahorro sin interés.
    const ratePct = Math.max(0.5, input.realAnnualRatePct + scenario.deltaPct);
    return {
      ...scenario,
      ratePct,
      projection: projectPortfolio({ ...input, realAnnualRatePct: ratePct }),
    };
  });
}

// ---------------------------------------------------------------------------
// Estimador de impuestos (Chile) — Premium
// ---------------------------------------------------------------------------

/**
 * Tramo del Impuesto Global Complementario, identificado por su tasa marginal.
 *
 * La ley define los tramos en UTA (unidad tributaria anual = 12 UTM), así que el
 * equivalente en pesos se deriva de `UTM_CLP` y es REFERENCIAL: cambia cada mes
 * con la UTM. Las cifras oficiales las publica el SII.
 */
export interface IgcBracket {
  ratePct: number;
  /** Tramo en UTM mensuales, como lo publica el SII. */
  utmRange: string;
  /** Renta mensual aproximada equivalente, en pesos de referencia. */
  hint: string;
}

export const IGC_BRACKETS: IgcBracket[] = [
  { ratePct: 0, utmRange: "hasta 13,5 UTM", hint: "exento" },
  { ratePct: 4, utmRange: "13,5 – 30 UTM", hint: "" },
  { ratePct: 8, utmRange: "30 – 50 UTM", hint: "" },
  { ratePct: 13.5, utmRange: "50 – 70 UTM", hint: "" },
  { ratePct: 23, utmRange: "70 – 90 UTM", hint: "" },
  { ratePct: 30.4, utmRange: "90 – 120 UTM", hint: "" },
  { ratePct: 35, utmRange: "120 – 310 UTM", hint: "" },
  { ratePct: 40, utmRange: "sobre 310 UTM", hint: "" },
];

export interface TaxEstimate {
  /** Ganancia de capital proyectada (los intereses acumulados). */
  gain: number;
  /** Impuesto acogiéndose al art. 107 LIR: cero, por eso existe la norma. */
  taxUnder107: number;
  /** Impuesto si la ganancia entra a la base del Global Complementario. */
  taxUnderIgc: number;
  /** Diferencia entre ambos caminos. */
  saving: number;
  /** Patrimonio final que queda en cada caso. */
  netUnder107: number;
  netUnderIgc: number;
}

/**
 * Compara los dos caminos tributarios de una ganancia de capital en Chile:
 *
 *  - Art. 107 LIR: la ganancia por enajenar acciones, cuotas de fondos y ETFs
 *    CON PRESENCIA BURSÁTIL, comprados y vendidos en bolsa (o en otras formas
 *    que la norma enumera), no paga impuesto a la renta.
 *  - Régimen general: la ganancia se suma a la base del Global Complementario y
 *    paga la tasa marginal que corresponda al total de rentas del año.
 *
 * ESTIMACIÓN GRUESA, a propósito: aplica la tasa marginal al total de la
 * ganancia real proyectada. No modela el reajuste por IPC del costo de
 * adquisición, ni los retiros parciales año a año, ni el efecto de que la propia
 * ganancia empuje al contribuyente a un tramo superior.
 */
export function estimateCapitalGainTax(gain: number, marginalRatePct: number): TaxEstimate {
  const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 0);
  const rate = clamp(marginalRatePct, 0, 100) / 100;
  const taxUnderIgc = safeGain * rate;

  return {
    gain: safeGain,
    taxUnder107: 0,
    taxUnderIgc,
    saving: taxUnderIgc,
    netUnder107: safeGain,
    netUnderIgc: safeGain - taxUnderIgc,
  };
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const CLP_FORMAT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const UF_FORMAT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "$1.234.567" — el peso chileno no usa decimales. */
export function formatClp(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `$${CLP_FORMAT.format(Math.round(safe))}`;
}

/** "1.234,5 UF" a partir de un monto en UF. */
export function formatUf(uf: number): string {
  const safe = Number.isFinite(uf) ? uf : 0;
  return `${UF_FORMAT.format(safe)} UF`;
}

/** "1.234,5 UF" a partir de un monto en pesos. */
export function formatClpAsUf(clp: number): string {
  return formatUf(clpToUf(clp));
}

/** Traduce meses a un texto legible: "12 años y 4 meses". */
export function formatMonthsAsYears(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = `${years} ${years === 1 ? "año" : "años"}`;
  if (rest === 0) return yearPart;
  const monthPart = `${rest} ${rest === 1 ? "mes" : "meses"}`;
  return years === 0 ? monthPart : `${yearPart} y ${monthPart}`;
}
