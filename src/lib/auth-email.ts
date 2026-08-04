// =============================================================================
// Normalización del correo de acceso — dominio compartido
//
// Supabase guarda el email tal cual se registró y compara la parte local de
// forma sensible a mayúsculas. Un mismo usuario que se registró como
// "Juan@Gmail.com" y luego escribe "juan@gmail.com" (o pega el correo con un
// espacio del autocompletado) no encuentra su cuenta al iniciar sesión.
//
// Por eso TODO formulario que hable con `supabase.auth` pasa el correo por aquí
// antes de enviarlo: registro, login y recuperación de contraseña normalizan
// igual, así que la cuenta creada es siempre la misma que la que se busca.
// =============================================================================

/** Deja el correo en su forma canónica: sin espacios sobrantes y en minúsculas. */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
