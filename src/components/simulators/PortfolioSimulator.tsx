"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  Crown,
  Gauge,
  Info,
  Landmark,
  Lightbulb,
  Lock,
  PieChart,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PortfolioChart } from "@/components/charts/PortfolioChart";
import {
  assessFinancialFreedom,
  buildScenarios,
  capitalForMonthlyIncome,
  estimateCapitalGainTax,
  formatClp,
  formatClpAsUf,
  formatMonthsAsYears,
  monthlyIncomeFromCapital,
  projectPortfolio,
  FREE_MAX_YEARS,
  FREE_RISK_PROFILE,
  FUNCTIONAL_MINIMUM_INCOME_CLP,
  IGC_BRACKETS,
  PREMIUM_MAX_YEARS,
  RISK_PROFILES,
  RISK_PROFILE_LIST,
  SAFE_WITHDRAWAL_RATE,
  SOLID_RETIREMENT_INCOME_CLP,
  UF_CLP,
  UTM_CLP,
  type FreedomVerdict,
  type ProjectionInput,
  type RiskProfileKey,
} from "@/lib/portfolio";

/** Tope del slider de aporte mensual (también acota el aporte sugerido). */
const MAX_MONTHLY_CLP = 5_000_000;

/**
 * Capital que sostiene una jubilación sólida: la meta IMPLÍCITA del simulador.
 *
 * Ya no se elige en un formulario — se deduce de la regla del 4% — y de ella
 * salen la línea objetivo del gráfico, el avance y el "¿cuándo llegaría?".
 */
const SOLID_TARGET_CAPITAL = capitalForMonthlyIncome(SOLID_RETIREMENT_INCOME_CLP);

// ===========================================================================
// Piezas de interfaz reutilizadas dentro del simulador
// ===========================================================================

/** Campo numérico con slider e input sincronizados. */
interface MoneyFieldProps {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Texto bajo el campo (equivalencia en UF, "/mes", …). */
  hint: string;
  suffix?: string;
  onChange: (value: number) => void;
}

function MoneyField({
  label,
  icon,
  value,
  min,
  max,
  step,
  hint,
  suffix,
  onChange,
}: MoneyFieldProps): ReactNode {
  function handle(raw: string): void {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(Math.min(Math.max(parsed, min), max));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <span className="text-slate-400">{icon}</span>
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            aria-label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => handle(e.target.value)}
            className="w-28 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-right text-sm tabular-nums text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          {suffix && <span className="w-8 text-xs text-slate-400">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => handle(e.target.value)}
        className="w-full accent-emerald-600"
      />
      <p className="mt-0.5 text-right text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

/** Tarjeta de resumen del bloque de resultados. */
interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "sky" | "amber";
}

const SUMMARY_TONES: Record<SummaryCardProps["tone"], string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
};

function SummaryCard({ icon, label, value, sub, tone }: SummaryCardProps): ReactNode {
  return (
    <div className={`rounded-2xl border p-4 ${SUMMARY_TONES[tone]}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
      <p className="mt-0.5 text-[11px] opacity-70">{sub}</p>
    </div>
  );
}

/** Contenedor de una sección de resultados (mismo marco para todas). */
function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-2">
        <span className="mt-0.5 text-emerald-600">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Marcador de una sección que exige membresía.
 *
 * Enseña QUÉ hay detrás (con una muestra difuminada) en vez de esconder la
 * sección: el usuario Free entiende qué gana antes de decidir si paga.
 */
function PremiumTeaser({
  icon,
  title,
  description,
  preview,
  priceLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  preview: ReactNode;
  priceLabel: string;
}): ReactNode {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[3px] saturate-50">
        {preview}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/70 via-white/90 to-white p-5 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          {icon}
        </span>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          {title}
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-slate-600">{description}</p>
        <Link
          href="/pricing"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
        >
          <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          Desbloquear con Premium · {priceLabel}/mes
        </Link>
      </div>
    </section>
  );
}

/** Paleta y icono de cada veredicto de libertad financiera. */
const VERDICT_STYLES: Record<
  FreedomVerdict,
  { box: string; title: string; icon: ReactNode; heading: string }
> = {
  solida: {
    box: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-900",
    icon: <CircleCheckBig className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
    heading: "Vas camino a una jubilación sólida",
  },
  funcional: {
    box: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    icon: <Timer className="h-4 w-4 text-amber-600" aria-hidden="true" />,
    heading: "Te alcanza para vivir, pero sin holgura",
  },
  insuficiente: {
    box: "border-sky-200 bg-sky-50",
    title: "text-sky-900",
    icon: <Lightbulb className="h-4 w-4 text-sky-600" aria-hidden="true" />,
    heading: "Todavía falta camino — y eso tiene arreglo",
  },
};

// ===========================================================================
// Simulador de portafolio e independencia financiera
// ===========================================================================

interface PortfolioSimulatorProps {
  /** True si `subscription_status === 'active'` (lo decide el servidor). */
  isPremium: boolean;
  /** Precio del plan ya formateado ("$4.990"). */
  priceLabel: string;
  /**
   * Año en curso, calculado en el servidor. Se pasa como prop en vez de leer el
   * reloj aquí para que el HTML del servidor y el del cliente coincidan.
   */
  currentYear: number;
}

export function PortfolioSimulator({
  isPremium,
  priceLabel,
  currentYear,
}: PortfolioSimulatorProps): ReactNode {
  const [initialClp, setInitialClp] = useState(2_000_000);
  const [monthlyClp, setMonthlyClp] = useState(200_000);
  const [years, setYears] = useState(isPremium ? 25 : FREE_MAX_YEARS);
  const [riskKey, setRiskKey] = useState<RiskProfileKey>(FREE_RISK_PROFILE);
  const [marginalRatePct, setMarginalRatePct] = useState(8);

  const maxYears = isPremium ? PREMIUM_MAX_YEARS : FREE_MAX_YEARS;

  // El muro de pago se aplica AQUÍ, no solo escondiendo botones: sin membresía,
  // el perfil y el horizonte se recortan aunque el estado diga otra cosa.
  const profile = RISK_PROFILES[isPremium ? riskKey : FREE_RISK_PROFILE];
  const effectiveYears = Math.min(years, maxYears);

  const projectionInput = useMemo<ProjectionInput>(
    () => ({
      initialClp,
      monthlyClp,
      years: effectiveYears,
      realAnnualRatePct: profile.realAnnualRatePct,
      goalClp: SOLID_TARGET_CAPITAL,
    }),
    [initialClp, monthlyClp, effectiveYears, profile.realAnnualRatePct],
  );

  const result = useMemo(() => projectPortfolio(projectionInput), [projectionInput]);

  const freedom = useMemo(
    () =>
      assessFinancialFreedom({
        finalBalance: result.finalBalance,
        initialClp,
        monthlyContribution: monthlyClp,
        years: effectiveYears,
        realAnnualRatePct: profile.realAnnualRatePct,
      }),
    [result.finalBalance, initialClp, monthlyClp, effectiveYears, profile.realAnnualRatePct],
  );

  const scenarios = useMemo(
    () => (isPremium ? buildScenarios(projectionInput) : []),
    [isPremium, projectionInput],
  );
  const tax = useMemo(
    () => estimateCapitalGainTax(result.totalInterest, marginalRatePct),
    [result.totalInterest, marginalRatePct],
  );

  const interestShare =
    result.finalBalance > 0
      ? Math.round((result.totalInterest / result.finalBalance) * 100)
      : 0;

  const verdictStyle = VERDICT_STYLES[freedom.verdict];

  // El aporte sugerido se redondea a la decena de miles: una cifra que se pueda
  // trasladar a un mandato de cargo automático sin decimales absurdos.
  const suggestedRounded =
    freedom.suggestedMonthly === null
      ? null
      : Math.ceil(freedom.suggestedMonthly / 10_000) * 10_000;
  const suggestionFitsSlider =
    suggestedRounded !== null && suggestedRounded <= MAX_MONTHLY_CLP;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ================================================================= */}
      {/* Columna de parámetros — fija y con scroll propio en escritorio     */}
      {/* ================================================================= */}
      <aside className="w-full lg:w-80 lg:flex-none">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-4 lg:pr-1">
          {/* --- Aportes y horizonte --- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Tus aportes
            </h2>
            <div className="flex flex-col gap-5">
              <MoneyField
                label="Capital inicial"
                icon={<PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />}
                value={initialClp}
                min={0}
                max={200_000_000}
                step={100_000}
                hint={`${formatClp(initialClp)} · ${formatClpAsUf(initialClp)}`}
                onChange={setInitialClp}
              />
              <MoneyField
                label="Aporte mensual"
                icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
                value={monthlyClp}
                min={0}
                max={MAX_MONTHLY_CLP}
                step={10_000}
                hint={`${formatClp(monthlyClp)} al mes · ${formatClpAsUf(monthlyClp)}`}
                onChange={setMonthlyClp}
              />
              <div>
                <MoneyField
                  label="Horizonte"
                  icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
                  value={effectiveYears}
                  min={1}
                  max={maxYears}
                  step={1}
                  suffix="años"
                  hint={`${effectiveYears} ${effectiveYears === 1 ? "año" : "años"} · hasta ${
                    currentYear + effectiveYears
                  }`}
                  onChange={setYears}
                />
                {!isPremium && (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                    <Lock className="mt-px h-3 w-3 flex-none" aria-hidden="true" />
                    <span>
                      La versión gratuita proyecta hasta {FREE_MAX_YEARS} años.{" "}
                      <Link href="/pricing" className="font-semibold underline">
                        Premium llega a {PREMIUM_MAX_YEARS}
                      </Link>
                      , que es donde el interés compuesto se nota de verdad.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* --- Perfil de riesgo --- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Gauge className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Perfil de riesgo
            </h2>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Rentabilidad <strong>real</strong> anual supuesta (ya descontada la inflación),
              por eso el resultado se puede leer en pesos de hoy y en UF.
            </p>
            <div className="flex flex-col gap-2">
              {RISK_PROFILE_LIST.map((item) => {
                const locked = !isPremium && item.key !== FREE_RISK_PROFILE;
                const isActive = item.key === profile.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={locked}
                    aria-pressed={isActive}
                    onClick={() => setRiskKey(item.key)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                        : locked
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                          : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`flex items-center gap-1.5 text-sm font-semibold ${
                          isActive ? "text-emerald-900" : "text-slate-700"
                        }`}
                      >
                        {locked && (
                          <Lock className="h-3 w-3 text-amber-500" aria-hidden="true" />
                        )}
                        {item.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.realAnnualRatePct}% real
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                      {locked ? "Disponible con Premium" : item.summary}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* --- Cómo se calcula la meta (ya no se elige) --- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              Tu meta se calcula sola
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              No hace falta que fijes un monto: con la{" "}
              <strong>regla del {SAFE_WITHDRAWAL_RATE * 100}%</strong> el simulador traduce tu
              patrimonio a la renta mensual que podrías retirar de por vida, y la compara con
              una jubilación sólida de {formatClp(SOLID_RETIREMENT_INCOME_CLP)} de hoy.
            </p>
          </section>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* Columna de resultados                                             */}
      {/* ================================================================= */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* --- Tarjetas de resumen --- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            tone="emerald"
            icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Patrimonio proyectado"
            value={formatClp(result.finalBalance)}
            sub={`${formatClpAsUf(result.finalBalance)} · UF a ${formatClp(UF_CLP)}`}
          />
          <SummaryCard
            tone="sky"
            icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Ganado por intereses"
            value={formatClp(result.totalInterest)}
            sub={`${interestShare}% del total · aportaste ${formatClp(result.totalContributed)}`}
          />
          <SummaryCard
            tone="amber"
            icon={<Banknote className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Renta mensual vitalicia"
            value={`${formatClp(freedom.monthlyIncome)}`}
            sub={`al mes · ${formatClpAsUf(freedom.monthlyIncome)}`}
          />
        </div>

        {/* ============================================================= */}
        {/* Libertad financiera — el resultado que de verdad importa       */}
        {/* ============================================================= */}
        <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <Banknote className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tu libertad financiera</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Lo que tu patrimonio te pagaría cada mes,{" "}
                <strong>sin tocar el capital</strong>, si dejaras de trabajar en{" "}
                {currentYear + effectiveYears}.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="text-4xl font-bold leading-none text-emerald-700">
                {formatClp(freedom.monthlyIncome)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-slate-600">
                al mes · {formatClpAsUf(freedom.monthlyIncome)}
              </p>
            </div>
            <p className="max-w-xs rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-200">
              Regla del {SAFE_WITHDRAWAL_RATE * 100}%: retiras{" "}
              {formatClp(result.finalBalance * SAFE_WITHDRAWAL_RATE)} al año de tus{" "}
              {formatClp(result.finalBalance)} y lo repartes en doce meses. El capital sigue
              trabajando, así que la renta no se agota.
            </p>
          </div>

          {/* Cobertura respecto a una jubilación sólida */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                Cobertura de una jubilación sólida ({formatClp(freedom.solidTargetIncome)}/mes)
              </span>
              <span className="font-bold tabular-nums text-slate-900">
                {Math.round(freedom.coveragePct)}%
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={Math.round(freedom.coveragePct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Cobertura de una jubilación sólida"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                style={{ width: `${Math.max(2, freedom.coveragePct)}%` }}
              />
            </div>
          </div>

          {/* Veredicto pedagógico */}
          <div className={`mt-4 rounded-xl border p-4 ${verdictStyle.box}`}>
            <h3
              className={`flex items-center gap-1.5 text-sm font-semibold ${verdictStyle.title}`}
            >
              {verdictStyle.icon}
              {verdictStyle.heading}
            </h3>

            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
              {freedom.verdict === "solida" && (
                <p>
                  En {effectiveYears} {effectiveYears === 1 ? "año" : "años"} tu patrimonio
                  pagaría <strong>{formatClp(freedom.monthlyIncome)} al mes</strong> de forma
                  indefinida, por encima de la referencia de{" "}
                  {formatClp(freedom.solidTargetIncome)}. A partir de aquí el trabajo deja de
                  ser una obligación y pasa a ser una elección.
                </p>
              )}

              {freedom.verdict === "funcional" && (
                <>
                  <p>
                    Tu patrimonio cubriría lo esencial —{" "}
                    <strong>{formatClp(freedom.monthlyIncome)} al mes</strong> — pero queda
                    bajo los {formatClp(freedom.solidTargetIncome)} que este simulador toma
                    como jubilación holgada. Es una pensión que aguanta el día a día y no los
                    imprevistos.
                  </p>
                  <p>
                    Te falta cubrir{" "}
                    <strong>
                      {formatClp(
                        Math.max(0, freedom.solidTargetIncome - freedom.monthlyIncome),
                      )}
                    </strong>{" "}
                    mensuales, que equivalen a{" "}
                    {formatClp(
                      Math.max(0, freedom.solidTargetCapital - result.finalBalance),
                    )}{" "}
                    más de capital.
                  </p>
                </>
              )}

              {freedom.verdict === "insuficiente" && (
                <>
                  <p>
                    Con estos supuestos tu patrimonio rendiría{" "}
                    <strong>{formatClp(freedom.monthlyIncome)} al mes</strong>, por debajo de{" "}
                    {monthlyClp > FUNCTIONAL_MINIMUM_INCOME_CLP ? (
                      <>
                        los <strong>{formatClp(monthlyClp)}</strong> que estás aportando cada
                        mes: tu esfuerzo mensual todavía pesa más que lo que la cartera te
                        devolvería
                      </>
                    ) : (
                      <>
                        el mínimo funcional de{" "}
                        <strong>{formatClp(FUNCTIONAL_MINIMUM_INCOME_CLP)}</strong> con el que
                        se puede sostener un hogar
                      </>
                    )}
                    .
                  </p>
                  <p>
                    No es un fracaso del plan: es que el interés compuesto necesita{" "}
                    <strong>tiempo</strong> para superar al aporte. Tienes tres palancas —
                    aportar más, alargar el horizonte o asumir más riesgo— y la primera es la
                    única que controlas por completo.
                  </p>
                </>
              )}
            </div>

            {/* Sugerencia accionable */}
            {suggestedRounded !== null && (
              <div className="mt-3 rounded-lg bg-white/80 p-3 ring-1 ring-slate-200">
                <p className="text-xs leading-relaxed text-slate-700">
                  Para llegar a{" "}
                  <strong>{formatClp(freedom.solidTargetIncome)} al mes</strong> en tus mismos{" "}
                  {effectiveYears} {effectiveYears === 1 ? "año" : "años"}, el aporte tendría
                  que ser de{" "}
                  <strong className="text-emerald-700">
                    {formatClp(suggestedRounded)} mensuales
                  </strong>{" "}
                  ({formatClpAsUf(suggestedRounded)}) — {formatClp(suggestedRounded - monthlyClp)}{" "}
                  más de lo que pusiste.
                </p>

                {suggestionFitsSlider ? (
                  <button
                    type="button"
                    onClick={() => setMonthlyClp(suggestedRounded)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Probar con este aporte
                  </button>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Esa cifra supera el máximo del simulador: en {effectiveYears}{" "}
                    {effectiveYears === 1 ? "año" : "años"} el ahorro solo no da para tanto. La
                    palanca realista aquí es el <strong>tiempo</strong> — sube el horizonte y
                    verás caer la cifra en picada.
                  </p>
                )}

                {result.monthsToGoal !== null && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Alternativa sin tocar tu aporte: manteniendo los{" "}
                    {formatClp(monthlyClp)} mensuales llegarías a esa jubilación sólida en{" "}
                    <strong>{formatMonthsAsYears(result.monthsToGoal)}</strong> (
                    {currentYear + Math.ceil(result.monthsToGoal / 12)}).
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* --- Gráfico --- */}
        <Panel
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          title="Tu bolsillo vs. el interés compuesto"
          description="Pasa el cursor por el gráfico para ver el detalle de cada año."
        >
          <PortfolioChart
            series={result.series}
            goalClp={freedom.solidTargetCapital}
            goalName="Jubilación sólida"
          />
        </Panel>

        {/* --- Escenarios de sensibilidad (Premium) --- */}
        {isPremium ? (
          <Panel
            icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
            title="Escenarios de sensibilidad"
            description="Nadie conoce la rentabilidad futura. Esto muestra cuánto cambia tu resultado si el supuesto se mueve ±2 puntos."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {scenarios.map((scenario) => {
                const isCentral = scenario.key === "esperado";
                const scenarioIncome = monthlyIncomeFromCapital(
                  scenario.projection.finalBalance,
                );
                return (
                  <div
                    key={scenario.key}
                    className={`rounded-xl border p-3 ${
                      isCentral
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-700">
                      {scenario.label}
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 ring-1 ring-slate-200">
                        {scenario.ratePct.toFixed(1)}%
                      </span>
                    </p>
                    <p className="mt-1.5 text-base font-bold text-slate-900">
                      {formatClp(scenario.projection.finalBalance)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatClpAsUf(scenario.projection.finalBalance)}
                    </p>
                    <p className="mt-2 border-t border-slate-200/70 pt-2 text-[11px] leading-snug text-slate-600">
                      Renta:{" "}
                      <strong className="text-slate-800">{formatClp(scenarioIncome)}</strong>/mes
                    </p>
                    <p className="text-[11px] leading-snug text-slate-500">
                      {scenario.projection.monthsToGoal === null
                        ? "No alcanza la jubilación sólida."
                        : `Sólida en ${formatMonthsAsYears(scenario.projection.monthsToGoal)}.`}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              La diferencia entre el peor y el mejor escenario es de{" "}
              {formatClp(
                Math.abs(
                  (scenarios[2]?.projection.finalBalance ?? 0) -
                    (scenarios[0]?.projection.finalBalance ?? 0),
                ),
              )}
              : ese es el tamaño real de tu incertidumbre, no un margen de error del cálculo.
            </p>
          </Panel>
        ) : (
          <PremiumTeaser
            priceLabel={priceLabel}
            icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
            title="Escenarios de sensibilidad"
            description="Compara la renta que tendrías en un escenario conservador, uno esperado y uno optimista para ver de cuánto depende tu jubilación."
            preview={
              <div className="grid grid-cols-3 gap-3 p-5">
                {["Conservador", "Esperado", "Optimista"].map((label) => (
                  <div key={label} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-700">{label}</p>
                    <p className="mt-1.5 text-base font-bold text-slate-900">$••.•••.•••</p>
                    <p className="text-[11px] text-slate-500">••• UF</p>
                    <p className="mt-2 text-[11px] text-slate-500">Renta: $•••.•••/mes</p>
                  </div>
                ))}
              </div>
            }
          />
        )}

        {/* --- Impuestos en Chile (Premium) --- */}
        {isPremium ? (
          <Panel
            icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
            title="Estimador de impuestos (Chile)"
            description="Qué pasa con tu ganancia de capital según cómo y dónde inviertas."
          >
            <div className="mb-4">
              <label
                htmlFor="igc-bracket"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Tu tramo estimado de Global Complementario
              </label>
              <select
                id="igc-bracket"
                value={marginalRatePct}
                onChange={(e) => setMarginalRatePct(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              >
                {IGC_BRACKETS.map((bracket) => (
                  <option key={bracket.ratePct} value={bracket.ratePct}>
                    {bracket.ratePct}% marginal — renta anual {bracket.utmRange}
                    {bracket.hint ? ` (${bracket.hint})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Los tramos los fija la ley en UTM (≈ {formatClp(UTM_CLP)} de referencia). Las
                cifras vigentes las publica el SII.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Con art. 107 LIR
                </p>
                <p className="mt-1.5 text-xl font-bold text-emerald-900">
                  {formatClp(tax.taxUnder107)}
                </p>
                <p className="text-[11px] text-emerald-700">de impuesto sobre la ganancia</p>
                <p className="mt-2 border-t border-emerald-200 pt-2 text-[11px] text-emerald-800">
                  Te quedas con <strong>{formatClp(tax.netUnder107)}</strong> de los{" "}
                  {formatClp(tax.gain)} ganados.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                  En Global Complementario
                </p>
                <p className="mt-1.5 text-xl font-bold text-slate-900">
                  {formatClp(tax.taxUnderIgc)}
                </p>
                <p className="text-[11px] text-slate-500">
                  al {marginalRatePct}% marginal sobre la ganancia
                </p>
                <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                  Te quedas con <strong>{formatClp(tax.netUnderIgc)}</strong> de los{" "}
                  {formatClp(tax.gain)} ganados.
                </p>
              </div>
            </div>

            {tax.saving > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                <strong>Diferencia: {formatClp(tax.saving)}</strong> ({formatClpAsUf(tax.saving)}
                ). Sobre tu renta mensual, son{" "}
                {formatClp(monthlyIncomeFromCapital(tax.saving))} al mes de por vida: elegir
                bien el vehículo puede pesar tanto como elegir bien el activo.
              </p>
            )}

            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              <p className="flex items-start gap-1.5">
                <Info className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                <span>
                  <strong>Art. 107 LIR:</strong> la ganancia por vender acciones, cuotas de
                  fondos y ETFs <em>con presencia bursátil</em>, comprados y vendidos en bolsa
                  (entre otras formas que la norma detalla), queda liberada del impuesto a la
                  renta. No todo instrumento califica, y el requisito de presencia bursátil se
                  verifica al momento de la venta.
                </span>
              </p>
              <p className="flex items-start gap-1.5">
                <Info className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                <span>
                  <strong>Sin esa exención</strong> la ganancia se suma a tus demás rentas del
                  año y tributa a la tasa marginal que te corresponda en el Global
                  Complementario.
                </span>
              </p>
              <p className="flex items-start gap-1.5">
                <Info className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                <span>
                  <strong>Estimación gruesa:</strong> aplica tu tasa marginal a toda la
                  ganancia proyectada. No modela el reajuste por IPC del costo de adquisición,
                  los retiros parciales, ni que la propia ganancia pueda empujarte a un tramo
                  superior. No es asesoría tributaria: confirma tu caso con el SII o un
                  contador.
                </span>
              </p>
            </div>
          </Panel>
        ) : (
          <PremiumTeaser
            priceLabel={priceLabel}
            icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
            title="Estimador de impuestos (Chile)"
            description="Cuánto de tu ganancia se queda Impuestos Internos y cuánto salvarías con la exención del art. 107 LIR."
            preview={
              <div className="grid grid-cols-2 gap-3 p-5">
                {["Con art. 107 LIR", "En Global Complementario"].map((label) => (
                  <div key={label} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-700">{label}</p>
                    <p className="mt-1.5 text-xl font-bold text-slate-900">$•.•••.•••</p>
                    <p className="text-[11px] text-slate-500">sobre la ganancia</p>
                  </div>
                ))}
              </div>
            }
          />
        )}

        {/* --- Distribución de cartera (Premium) --- */}
        {isPremium ? (
          <Panel
            icon={<PieChart className="h-4 w-4" aria-hidden="true" />}
            title={`Cartera de referencia — perfil ${profile.label}`}
            description={`Ejemplo académico de cómo se suele repartir un ${profile.realAnnualRatePct}% real. ${profile.volatility}`}
          >
            {/* Barra apilada */}
            <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
              {profile.allocation.map((slice) => (
                <div
                  key={slice.label}
                  className={slice.colorClass}
                  style={{ width: `${slice.pct}%` }}
                  title={`${slice.label}: ${slice.pct}%`}
                />
              ))}
            </div>

            <ul className="flex flex-col gap-3">
              {profile.allocation.map((slice) => (
                <li key={slice.label} className="flex items-start gap-2.5">
                  <span
                    className={`mt-1 h-2.5 w-2.5 flex-none rounded-sm ${slice.colorClass}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {slice.label}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {slice.pct}%
                      </span>
                    </p>
                    <p className="text-[11px] leading-snug text-slate-500">{slice.examples}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                      ≈ {formatClp((result.finalBalance * slice.pct) / 100)} de tu patrimonio
                      proyectado
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <Info className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
              <span>
                Reparto <strong>educativo por clase de activo</strong>, del tipo que se usa
                para explicar la relación entre riesgo y retorno. Los instrumentos son ejemplos
                de qué suele ocupar cada casilla, no una recomendación de compra: no conocemos
                tu situación, tus deudas ni tus plazos. Para decidir de verdad, habla con un
                asesor registrado en la CMF.
              </span>
            </p>
          </Panel>
        ) : (
          <PremiumTeaser
            priceLabel={priceLabel}
            icon={<PieChart className="h-4 w-4" aria-hidden="true" />}
            title="Cartera de referencia por perfil"
            description="Cómo se reparte cada perfil entre renta fija en UF, bolsa desarrollada (VOO / S&P 500) y emergentes o tecnología."
            preview={
              <div className="p-5">
                <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
                  <div className="w-[35%] bg-sky-500" />
                  <div className="w-[50%] bg-emerald-500" />
                  <div className="w-[15%] bg-violet-500" />
                </div>
                <ul className="flex flex-col gap-3">
                  {["Renta fija en UF", "Bolsa global desarrollada", "Emergentes y tecnología"].map(
                    (label) => (
                      <li key={label} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800">{label}</span>
                        <span className="text-sm font-bold text-slate-900">••%</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            }
          />
        )}

        {/* --- Aviso legal --- */}
        <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-slate-400">
          Ejercicio educativo con capitalización mensual y los supuestos que tú defines. La
          regla del {SAFE_WITHDRAWAL_RATE * 100}% es una referencia histórica discutida, no una
          garantía de que la renta dure para siempre. Las rentabilidades pasadas no garantizan
          las futuras y ninguna cifra de esta página es una proyección real, una promesa de
          rentabilidad ni asesoría de inversión o tributaria. La UF se estima fija en{" "}
          {formatClp(UF_CLP)}; en la realidad se reajusta a diario con el IPC.
        </p>

        {isPremium && (
          <Link
            href="/dashboard/mercados"
            className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <PieChart className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Mira las fichas de los ETFs que aparecen en tu cartera
            </span>
            <ArrowRight className="h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
