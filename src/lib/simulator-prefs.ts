// =============================================================================
// Preferencias del Simulador UF — persistencia en el navegador.
//
// Los parámetros del formulario sobreviven a la navegación guardándose en
// `localStorage`. Es deliberadamente LOCAL y no va a Supabase: son supuestos de
// un ejercicio educativo, no datos de la cuenta, y guardarlos en el servidor
// obligaría a escribir en la BD en cada movimiento de un slider.
//
// Todo lo que sale de `localStorage` se trata como ENTRADA NO CONFIABLE: el
// usuario (o cualquier script del mismo origen) puede escribir ahí lo que
// quiera, así que se valida campo a campo y ante cualquier duda se cae a los
// valores por defecto en vez de propagar un `NaN` al motor de cálculo.
// =============================================================================

import { clamp } from "@/lib/finance";
import {
  FREE_MAX_YEARS,
  FREE_RISK_PROFILE,
  PREMIUM_MAX_YEARS,
  RISK_PROFILES,
  type RiskProfileKey,
} from "@/lib/portfolio";

/**
 * Clave de almacenamiento. Lleva versión: si algún día cambian los campos,
 * basta subir el `v` para ignorar lo guardado por versiones antiguas en vez de
 * tener que migrarlo.
 */
export const SIMULATOR_PREFS_KEY = "tutor-financiero:simulador-uf:v1";

/**
 * Topes de los sliders. Viven aquí porque también acotan lo que se relee.
 *
 * Son deliberadamente altos: el simulador tiene que servir tanto a quien parte
 * con $0 como a quien vende una propiedad y reinvierte. Quien necesite una
 * cifra exacta la escribe en el campo, que admite cualquier valor del rango; el
 * slider solo da el barrido grueso.
 */
export const MAX_INITIAL_CLP = 500_000_000;
export const MAX_MONTHLY_CLP = 10_000_000;

/** Los parámetros que el usuario elige y que merece la pena recordar. */
export interface SimulatorPrefs {
  initialClp: number;
  monthlyClp: number;
  years: number;
  riskKey: RiskProfileKey;
}

/**
 * Valores de arranque de quien nunca ha tocado el simulador.
 *
 * Depende de la membresía, que el servidor ya conoce al renderizar: por eso el
 * HTML del servidor y el primer render del cliente coinciden siempre.
 */
export function defaultSimulatorPrefs(isPremium: boolean): SimulatorPrefs {
  return {
    initialClp: 2_000_000,
    monthlyClp: 200_000,
    years: isPremium ? 25 : FREE_MAX_YEARS,
    riskKey: FREE_RISK_PROFILE,
  };
}

/** True si el valor es una de las tres claves de perfil conocidas. */
function isRiskProfileKey(value: unknown): value is RiskProfileKey {
  // `hasOwnProperty` y no `in`: `"toString" in RISK_PROFILES` sería true.
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(RISK_PROFILES, value)
  );
}

/** Devuelve el número si es utilizable; si no, el valor por defecto. */
function safeNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

/**
 * Lee las preferencias guardadas.
 *
 * Devuelve `null` si no hay nada, si el navegador no permite `localStorage`
 * (modo privado de Safari, almacenamiento bloqueado) o si lo guardado no es
 * JSON válido. Nunca lanza: perder las preferencias no puede tumbar la página.
 *
 * El horizonte se acota al máximo Premium, no al del usuario: recortarlo según
 * la membresía es trabajo del componente, que ya lo hace en cada render.
 */
export function readSimulatorPrefs(fallback: SimulatorPrefs): SimulatorPrefs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SIMULATOR_PREFS_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const data = parsed as Record<string, unknown>;

    return {
      initialClp: safeNumber(data.initialClp, 0, MAX_INITIAL_CLP, fallback.initialClp),
      monthlyClp: safeNumber(data.monthlyClp, 0, MAX_MONTHLY_CLP, fallback.monthlyClp),
      years: Math.round(safeNumber(data.years, 1, PREMIUM_MAX_YEARS, fallback.years)),
      riskKey: isRiskProfileKey(data.riskKey) ? data.riskKey : fallback.riskKey,
    };
  } catch {
    return null;
  }
}

/** Guarda las preferencias. Si el navegador no deja escribir, no pasa nada. */
export function writeSimulatorPrefs(prefs: SimulatorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIMULATOR_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Cuota llena o almacenamiento bloqueado: el simulador sigue funcionando,
    // simplemente no recordará nada la próxima visita.
  }
}
