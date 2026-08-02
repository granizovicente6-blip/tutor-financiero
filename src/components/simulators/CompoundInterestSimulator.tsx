"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { NumberField } from "@/components/simulators/NumberField";
import { formatCurrency, projectCompoundInterest } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Simulador de interés compuesto / proyección de ahorro
//
// Los topes están pensados para pesos chilenos, la moneda de la app: encerrar
// el aporte inicial en cinco cifras dejaba fuera cualquier caso real.
// ---------------------------------------------------------------------------

const MAX_PRINCIPAL = 500_000_000;
const MAX_MONTHLY = 10_000_000;

export function CompoundInterestSimulator(): ReactNode {
  const [principal, setPrincipal] = useState<number>(1_000_000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(100_000);
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
          <NumberField
            label="Aporte inicial"
            value={principal}
            min={0}
            max={MAX_PRINCIPAL}
            step={100_000}
            hint={formatCurrency(principal)}
            onChange={setPrincipal}
          />
          <NumberField
            label="Aporte mensual"
            value={monthlyContribution}
            min={0}
            max={MAX_MONTHLY}
            step={10_000}
            hint={`${formatCurrency(monthlyContribution)} / mes`}
            onChange={setMonthlyContribution}
          />
          <NumberField
            label="Tasa anual"
            value={annualRatePct}
            min={0}
            max={20}
            step={0.5}
            decimals
            suffix="%"
            inputWidthClass="w-20"
            hint={`${annualRatePct}% anual (supuesto)`}
            onChange={setAnnualRatePct}
          />
          <NumberField
            label="Horizonte"
            value={years}
            min={1}
            max={50}
            step={1}
            suffix="años"
            inputWidthClass="w-20"
            hint={`${years} ${years === 1 ? "año" : "años"}`}
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
