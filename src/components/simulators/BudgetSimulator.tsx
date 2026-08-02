"use client";

import { useMemo, useState, type ReactNode } from "react";
import { NumberField } from "@/components/simulators/NumberField";
import { formatCurrency, splitBudget5030020 } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Presupuestador 50/30/20
//
// El usuario introduce su ingreso neto mensual y reparte entre necesidades,
// deseos y futuro (ahorro/deuda). Arranca en la regla 50/30/20 pero puede
// ajustar los porcentajes para comparar su reparto ideal con otras opciones.
// Todo es cómputo puro en el cliente.
// ---------------------------------------------------------------------------

interface Category {
  key: "needs" | "wants" | "savings";
  label: string;
  hint: string;
  /** Clases de color para barra y punto. */
  barClass: string;
  dotClass: string;
  textClass: string;
}

const CATEGORIES: Category[] = [
  {
    key: "needs",
    label: "Necesidades",
    hint: "Vivienda, comida, transporte, servicios básicos.",
    barClass: "bg-blue-400",
    dotClass: "bg-blue-400",
    textClass: "text-blue-700",
  },
  {
    key: "wants",
    label: "Deseos",
    hint: "Ocio, restaurantes, suscripciones, caprichos.",
    barClass: "bg-amber-400",
    dotClass: "bg-amber-400",
    textClass: "text-amber-700",
  },
  {
    key: "savings",
    label: "Futuro (ahorro/deuda)",
    hint: "Ahorro, fondo de emergencia y pago de deudas.",
    barClass: "bg-emerald-500",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
];

const DEFAULT_PCT = { needs: 50, wants: 30, savings: 20 };

/**
 * Tope del ingreso mensual, en pesos chilenos (la moneda de la app). Un único
 * valor para el campo y el slider: antes el input decía 20.000 y el saneado
 * recortaba a 1.000.000, así que ninguno de los dos era el límite real.
 */
const MAX_INCOME = 20_000_000;

export function BudgetSimulator(): ReactNode {
  const [income, setIncome] = useState<number>(1_200_000);
  const [pct, setPct] = useState<Record<Category["key"], number>>(DEFAULT_PCT);

  const total = pct.needs + pct.wants + pct.savings;
  const isBalanced = total === 100;

  // Reparto recomendado (referencia fija 50/30/20) según el ingreso.
  const recommended = useMemo(() => splitBudget5030020(income), [income]);

  function setCategoryPct(key: Category["key"], value: number): void {
    setPct((prev) => ({ ...prev, [key]: Math.round(value) }));
  }

  function reset(): void {
    setPct(DEFAULT_PCT);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Controles */}
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-80 lg:flex-none">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Tu ingreso y reparto</h2>

        {/* Ingreso */}
        <div className="mb-5">
          <NumberField
            label="Ingreso neto mensual"
            value={income}
            min={0}
            max={MAX_INCOME}
            step={10_000}
            hint={`${formatCurrency(income)} / mes`}
            onChange={setIncome}
          />
        </div>

        {/* Porcentajes por categoría */}
        <div className="flex flex-col gap-4">
          {CATEGORIES.map((cat) => (
            <NumberField
              key={cat.key}
              label={cat.label}
              icon={
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cat.dotClass}`} />
              }
              value={pct[cat.key]}
              min={0}
              max={100}
              step={1}
              suffix="%"
              inputWidthClass="w-16"
              onChange={(value) => setCategoryPct(cat.key, value)}
            />
          ))}
        </div>

        {/* Estado de la suma */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">Suma de porcentajes</span>
          <span className={isBalanced ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
            {total}%
          </span>
        </div>
        {!isBalanced && (
          <p className="mt-2 text-[11px] leading-snug text-amber-700">
            Tu reparto suma {total}%. Ajústalo hasta llegar a 100% para cuadrar tu presupuesto.
          </p>
        )}
        <button
          onClick={reset}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Restablecer a 50/30/20
        </button>
      </section>

      {/* Desglose visual */}
      <section className="min-w-0 flex-1">
        {/* Barra apilada */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-slate-100">
            {CATEGORIES.map((cat) => {
              const width = total > 0 ? (pct[cat.key] / total) * 100 : 0;
              return (
                <div
                  key={cat.key}
                  className={`${cat.barClass} h-full transition-all duration-300`}
                  style={{ width: `${width}%` }}
                  title={`${cat.label}: ${pct[cat.key]}%`}
                />
              );
            })}
          </div>

          {/* Tarjetas por categoría */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const amount = (income * pct[cat.key]) / 100;
              return (
                <div key={cat.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cat.dotClass}`} />
                    <p className="text-xs font-medium text-slate-500">{cat.label}</p>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(amount)}</p>
                  <p className={`text-xs font-medium ${cat.textClass}`}>{pct[cat.key]}% del ingreso</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{cat.hint}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referencia 50/30/20 */}
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <span className="font-semibold">Referencia 50/30/20 para tu ingreso: </span>
          Necesidades {formatCurrency(recommended.needs)} · Deseos {formatCurrency(recommended.wants)} ·
          Futuro {formatCurrency(recommended.savings)}.
        </div>

        <p className="mt-3 text-center text-[11px] leading-snug text-slate-400">
          Guía educativa orientativa. Ajusta los porcentajes a tu realidad (por ejemplo, si el
          alquiler es alto). No es asesoría financiera.
        </p>
      </section>
    </div>
  );
}
