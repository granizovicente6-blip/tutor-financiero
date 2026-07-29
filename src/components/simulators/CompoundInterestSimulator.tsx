"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { formatCurrency, projectCompoundInterest } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Campo con slider + entrada numérica sincronizados
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  displayValue: string;
  onChange: (value: number) => void;
}

function Field({
  label,
  value,
  min,
  max,
  step,
  unit,
  displayValue,
  onChange,
}: FieldProps): ReactNode {
  function handle(raw: string): void {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(Math.min(Math.max(parsed, min), max));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            aria-label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => handle(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-right text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          {unit && <span className="w-6 text-sm text-slate-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => handle(e.target.value)}
        className="w-full accent-emerald-600"
        aria-label={label}
      />
      <p className="mt-0.5 text-right text-[11px] text-slate-400">{displayValue}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulador de interés compuesto / proyección de ahorro
// ---------------------------------------------------------------------------
export function CompoundInterestSimulator(): ReactNode {
  const [principal, setPrincipal] = useState<number>(1000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(100);
  const [annualRatePct, setAnnualRatePct] = useState<number>(7);
  const [years, setYears] = useState<number>(20);

  const result = useMemo(
    () =>
      projectCompoundInterest({
        principal,
        monthlyContribution,
        annualRatePct,
        years,
      }),
    [principal, monthlyContribution, annualRatePct, years],
  );

  const interestShare =
    result.finalBalance > 0
      ? Math.round((result.totalInterest / result.finalBalance) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Controles */}
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-80 lg:flex-none">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Tus supuestos</h2>
        <div className="flex flex-col gap-5">
          <Field
            label="Aporte inicial"
            value={principal}
            min={0}
            max={100000}
            step={100}
            displayValue={formatCurrency(principal)}
            onChange={setPrincipal}
          />
          <Field
            label="Aporte mensual"
            value={monthlyContribution}
            min={0}
            max={5000}
            step={50}
            displayValue={`${formatCurrency(monthlyContribution)} / mes`}
            onChange={setMonthlyContribution}
          />
          <Field
            label="Tasa anual"
            value={annualRatePct}
            min={0}
            max={20}
            step={0.5}
            unit="%"
            displayValue={`${annualRatePct}% anual (supuesto)`}
            onChange={setAnnualRatePct}
          />
          <Field
            label="Horizonte"
            value={years}
            min={1}
            max={50}
            step={1}
            unit="a"
            displayValue={`${years} ${years === 1 ? "año" : "años"}`}
            onChange={setYears}
          />
        </div>
      </section>

      {/* Resultados + gráfico */}
      <section className="min-w-0 flex-1">
        {/* Tarjetas de resultado */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Saldo final estimado</p>
            <p className="mt-1 text-xl font-bold text-emerald-900">
              {formatCurrency(result.finalBalance)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Total aportado</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatCurrency(result.totalContributed)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Intereses generados</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatCurrency(result.totalInterest)}
              <span className="ml-1 text-xs font-medium text-emerald-600">
                ({interestShare}%)
              </span>
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <GrowthChart series={result.series} />
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />
              Capital aportado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/70" />
              Intereses
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] leading-snug text-slate-400">
          Ejemplo educativo con capitalización mensual y los supuestos que tú defines.
          No es una proyección real, garantía de rentabilidad ni asesoría de inversión.
        </p>
      </section>
    </div>
  );
}
