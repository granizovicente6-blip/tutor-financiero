// =============================================================================
// Matemática financiera — funciones puras (sin dependencias, sin efectos).
//
// Se usan en los simuladores del cliente. Todo es determinista y sincrónico:
// no hay red, ni BD, ni IA. Los resultados son ILUSTRACIONES basadas en los
// supuestos que introduce el usuario (no proyecciones ni asesoría).
// =============================================================================

export interface CompoundInterestInput {
  /** Aporte inicial. */
  principal: number;
  /** Aporte periódico mensual (puede ser 0). */
  monthlyContribution: number;
  /** Tasa de interés anual nominal, en porcentaje (p. ej. 7 = 7%). */
  annualRatePct: number;
  /** Horizonte en años (entero >= 1). */
  years: number;
}

/** Punto de la serie al final de cada año. */
export interface YearPoint {
  /** Año transcurrido (0 = inicio, 1 = fin del primer año, …). */
  year: number;
  /** Saldo total acumulado al final del año. */
  balance: number;
  /** Total aportado hasta ese momento (principal + aportes acumulados). */
  contributed: number;
  /** Intereses generados hasta ese momento (balance - contributed). */
  interest: number;
}

export interface CompoundInterestResult {
  /** Serie anual, incluyendo el punto inicial (year 0). */
  series: YearPoint[];
  /** Saldo final al terminar el horizonte. */
  finalBalance: number;
  /** Total aportado (principal + todos los aportes). */
  totalContributed: number;
  /** Total de intereses generados. */
  totalInterest: number;
}

/** Restringe un número a un rango [min, max] (defensa ante inputs extremos). */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Proyecta el crecimiento de un ahorro con aportes mensuales e interés
 * compuesto (capitalización mensual). Devuelve una serie anual para graficar.
 *
 * Fórmula por mes: saldo = saldo * (1 + i) + aporte, donde i = tasa anual / 12.
 * Se itera mes a mes (claro y exacto) y se toma una foto al cierre de cada año.
 */
export function projectCompoundInterest(
  input: CompoundInterestInput,
): CompoundInterestResult {
  const principal = clamp(input.principal, 0, 1_000_000_000);
  const monthlyContribution = clamp(input.monthlyContribution, 0, 100_000_000);
  const annualRatePct = clamp(input.annualRatePct, 0, 100);
  const years = Math.round(clamp(input.years, 1, 100));

  const monthlyRate = annualRatePct / 100 / 12;

  const series: YearPoint[] = [
    { year: 0, balance: principal, contributed: principal, interest: 0 },
  ];

  let balance = principal;
  let contributed = principal;

  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    contributed += monthlyContribution;

    if (month % 12 === 0) {
      series.push({
        year: month / 12,
        balance,
        contributed,
        interest: balance - contributed,
      });
    }
  }

  return {
    series,
    finalBalance: balance,
    totalContributed: contributed,
    totalInterest: balance - contributed,
  };
}

/** Reparto de presupuesto según la regla 50/30/20 (para el próximo simulador). */
export interface BudgetSplit {
  needs: number;
  wants: number;
  savings: number;
}

export function splitBudget5030020(monthlyIncome: number): BudgetSplit {
  const income = clamp(monthlyIncome, 0, 1_000_000_000);
  return {
    needs: income * 0.5,
    wants: income * 0.3,
    savings: income * 0.2,
  };
}

/**
 * Formatea un número como moneda. Sin símbolo de país fijo para no atarnos a una
 * región: usa separadores de miles y 0 decimales (montos grandes se leen mejor).
 */
export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
}
