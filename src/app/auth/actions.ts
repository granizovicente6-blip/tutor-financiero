"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Action: cierra la sesión del usuario y lo devuelve a la portada.
 *
 * Con el modelo guest-first la portada es pública, así que al salir se aterriza
 * en ella (y no en un formulario de login sin contexto).
 * Se usa como `action` de un <form> en el Sidebar.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
