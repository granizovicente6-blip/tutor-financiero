import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cliente de Supabase para el NAVEGADOR (Client Components, `"use client"`).
 *
 * Usa las variables públicas `NEXT_PUBLIC_*`, que sí pueden exponerse al
 * cliente. La `anon key` es segura de publicar: el acceso a los datos está
 * protegido por las políticas de Row Level Security (RLS) definidas en la BD.
 *
 * Uso:
 *   const supabase = createClient();
 *   const { data } = await supabase.from("conversations").select();
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
