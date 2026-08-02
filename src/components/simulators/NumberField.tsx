"use client";

import { useState, type ReactNode } from "react";
import { clamp } from "@/lib/finance";

// ---------------------------------------------------------------------------
// Campo numérico con slider e input sincronizados.
//
// Lo comparten los tres simuladores para que escribir una cifra se comporte
// igual en toda la app. Resuelve los tropiezos clásicos de un input numérico
// controlado por un `number`:
//
//  1. El campo NO puede quedarse vacío: al borrarlo aparece un "0" que estorba
//     y contra el que hay que pelear para escribir encima ("0200000").
//  2. Aplicar el mínimo mientras se teclea impide escribir cifras que empiezan
//     por un dígito menor: con min=1 no se puede llegar a "25" porque el "2"
//     se queda solo un instante y ya se corrige.
//
// La solución es un BORRADOR: mientras el campo tiene el foco manda el texto
// que está escribiendo la persona, no el número del estado. El mínimo se aplica
// al salir del campo, y el máximo sí en el momento (pasarse es un error que
// conviene ver al instante). Al soltar el foco, el borrador desaparece y vuelve
// a mandar el estado, ya normalizado y sin ceros a la izquierda.
//
// El input es `type="text"` con `inputMode="numeric"` a propósito: `type=
// "number"` deja pasar "e", "+" y "-", devuelve cadena vacía ante cualquier
// texto inválido (perdiendo lo tecleado) y cambia de valor con la rueda del
// ratón. Aquí el saneado lo hacemos nosotros y es predecible.
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Salto del slider. El campo de texto admite cualquier valor del rango. */
  step: number;
  /** Texto de apoyo bajo el control (equivalencia en UF, "/mes", …). */
  hint?: string;
  /** Unidad mostrada a la derecha del campo ("%", "años"). */
  suffix?: string;
  /** Icono a la izquierda de la etiqueta. */
  icon?: ReactNode;
  /** True para admitir decimales (tasas). Por defecto solo enteros. */
  decimals?: boolean;
  /** Ancho del input, por si un campo corto (porcentajes) queda mejor. */
  inputWidthClass?: string;
  onChange: (value: number) => void;
}

/** "007" → "7"; "0" → "0"; "" → "". */
function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  hint,
  suffix,
  icon,
  decimals = false,
  inputWidthClass = "w-28",
  onChange,
}: NumberFieldProps): ReactNode {
  /** Texto en curso; `null` significa "muestra el valor del estado". */
  const [draft, setDraft] = useState<string | null>(null);

  /** Deja solo lo que puede formar un número y quita los ceros sobrantes. */
  function sanitize(raw: string): string {
    if (!decimals) return stripLeadingZeros(raw.replace(/\D/g, ""));

    // Con decimales: se acepta la coma como separador y se conserva uno solo.
    const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
    const [whole = "", ...rest] = cleaned.split(".");
    const head = stripLeadingZeros(whole);
    return rest.length > 0 ? `${head}.${rest.join("")}` : head;
  }

  function parse(text: string): number | null {
    const parsed = decimals ? Number.parseFloat(text) : Number.parseInt(text, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function handleType(raw: string): void {
    const text = sanitize(raw);
    const parsed = parse(text);

    // Vacío o a medio escribir ("0.", "."): se deja ver tal cual y el estado
    // conserva el último valor válido, así el gráfico no salta a cero.
    if (parsed === null) {
      setDraft(text);
      return;
    }

    // El techo sí se aplica al vuelo, y el borrador se corrige con él para que
    // el campo nunca muestre una cifra que el simulador no está usando.
    const capped = Math.min(parsed, max);
    setDraft(capped === parsed ? text : String(capped));
    onChange(capped);
  }

  /** Al salir del campo se aplica el mínimo y se devuelve el mando al estado. */
  function handleBlur(): void {
    if (draft === null) return;
    const parsed = parse(draft);
    onChange(parsed === null ? min : clamp(parsed, min, max));
    setDraft(null);
  }

  function handleSlide(raw: string): void {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setDraft(null);
    onChange(clamp(parsed, min, max));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          {icon && <span className="text-slate-400">{icon}</span>}
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode={decimals ? "decimal" : "numeric"}
            aria-label={label}
            value={draft ?? String(value)}
            onChange={(e) => handleType(e.target.value)}
            onBlur={handleBlur}
            // Seleccionar todo al enfocar: escribir encima reemplaza la cifra
            // en vez de obligar a borrarla dígito a dígito.
            onFocus={(e) => e.target.select()}
            className={`${inputWidthClass} rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-right text-sm tabular-nums text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`}
          />
          {suffix && <span className="w-8 text-xs text-slate-400">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        value={clamp(value, min, max)}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => handleSlide(e.target.value)}
        className="w-full accent-emerald-600"
      />
      {hint && <p className="mt-0.5 text-right text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
