// =============================================================================
// Lectura de las credenciales de Supabase — cliente y servidor
//
// Existe para que una variable mal puesta falle DICIENDO cuál. Antes se leían
// con `process.env.X!`: la aserción calla a TypeScript pero en ejecución pasa
// `undefined`, y entonces el SDK arma la URL "undefined/auth/v1/signup" y el
// fetch revienta con un AuthRetryableFetchError —un error de red genérico que
// no menciona la variable y manda a buscar el fallo al sitio equivocado.
//
// El `.trim()` no es decorativo: pegar el valor en Vercel arrastra con
// facilidad un espacio o un salto de línea final, y `https://x.supabase.co\n`
// produce exactamente el mismo error de red que no tener nada.
// =============================================================================

/** Lee una variable obligatoria, ya recortada, o explica cuál falta. */
function required(name: string, value: string | undefined): string {
  const clean = value?.trim();
  if (!clean) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configúrala en .env.local (local) ` +
        `o en Vercel -> Project Settings -> Environment Variables, y vuelve a desplegar.`,
    );
  }
  return clean;
}

/** URL del proyecto de Supabase. Se valida que sea una URL http(s) real. */
export function supabaseUrl(): string {
  const value = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL no es una URL válida (${value}). ` +
        `Debe ser el "Project URL" completo, con https:// y sin barra final.`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL debe empezar por https:// (recibido: ${value}).`);
  }

  return value.replace(/\/$/, "");
}

/** Clave pública (anon) del proyecto. Publicarla es seguro: la protección es RLS. */
export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
