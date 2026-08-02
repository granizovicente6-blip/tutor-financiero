import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreApprovalClient, getSiteUrl } from "@/lib/mercadopago";
import { getSubscription, hasPremiumAccess, PREMIUM_PLAN } from "@/lib/subscription";
import { API_ROUTES, enforceRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * API Route: POST /api/mercadopago/create-subscription
 *
 * Crea (o recupera) la suscripción mensual del usuario autenticado en Mercado
 * Pago y devuelve la URL del checkout a la que hay que redirigirlo.
 *
 * Flujo:
 *  1. Autentica al usuario (sin sesión -> 401).
 *  2. Si ya tiene acceso Premium, no crea nada (409): evita cobros duplicados.
 *  3. Si dejó un checkout a medias, REUTILIZA esa suscripción pendiente en vez
 *     de crear otra (dos `preapproval` autorizados = dos cobros al mes).
 *  4. Crea el `preapproval` con `external_reference = user.id`, que es la clave
 *     con la que el webhook vuelve a encontrar al usuario.
 *  5. Guarda el id y deja el perfil en 'pending' (con el rol de servicio: esas
 *     columnas están blindadas contra escrituras del navegador).
 *
 * El acceso NO se concede aquí: solo lo concede el webhook al confirmar el pago.
 *
 * Respuesta: { checkoutUrl: string, preapprovalId: string }
 */

/** Precio en CLP: la moneda no tiene decimales, así que el monto va entero. */
const { amount, currencyId, frequency, frequencyType, name } = PREMIUM_PLAN;

export async function POST(): Promise<Response> {
  // 1. Autenticación.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  const rate = await enforceRateLimit(supabase, API_ROUTES.createSubscription);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter);
  }

  // 2. ¿Ya es Premium? No tiene sentido abrir otro checkout.
  const subscription = await getSubscription(supabase, user.id);
  if (hasPremiumAccess(subscription)) {
    return Response.json(
      { error: "Ya tienes una suscripción activa." },
      { status: 409 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  let preApproval: ReturnType<typeof getPreApprovalClient>;
  try {
    admin = createAdminClient();
    preApproval = getPreApprovalClient();
  } catch (configError) {
    console.error("[create-subscription] Configuración incompleta:", configError);
    return Response.json(
      { error: "Los pagos no están configurados en el servidor." },
      { status: 500 },
    );
  }

  // 3. Reutilizar un checkout a medias, si sigue pendiente en Mercado Pago.
  if (subscription.preapprovalId) {
    try {
      const existing = await preApproval.get({ id: subscription.preapprovalId });
      if (existing.status === "pending" && existing.init_point) {
        return Response.json({
          checkoutUrl: existing.init_point,
          preapprovalId: existing.id ?? subscription.preapprovalId,
        });
      }
    } catch (error) {
      // La suscripción anterior ya no existe o no se pudo consultar: seguimos y
      // creamos una nueva. No es motivo para bloquear al usuario.
      console.warn(
        "[create-subscription] No se pudo recuperar la suscripción previa:",
        error,
      );
    }
  }

  // 4. Crear la suscripción en Mercado Pago.
  //    `status: 'pending'` + sin `card_token_id` = Mercado Pago devuelve el
  //    `init_point` para que el usuario autorice el cobro en su checkout.
  let created;
  try {
    created = await preApproval.create({
      body: {
        reason: name,
        external_reference: user.id,
        payer_email: user.email ?? undefined,
        back_url: `${getSiteUrl()}/pricing?estado=procesando`,
        status: "pending",
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: amount,
          currency_id: currencyId,
        },
      },
    });
  } catch (error) {
    console.error("[create-subscription] Mercado Pago rechazó la creación:", error);
    return Response.json(
      { error: "No se pudo iniciar la suscripción. Inténtalo de nuevo en un momento." },
      { status: 502 },
    );
  }

  // Mercado Pago devuelve `init_point`; con credenciales de prueba algunas
  // cuentas responden además con `sandbox_init_point` (no está en los tipos del
  // SDK, de ahí la lectura defensiva).
  const sandboxInitPoint = (created as { sandbox_init_point?: string })
    .sandbox_init_point;
  const checkoutUrl = created.init_point ?? sandboxInitPoint;

  if (!created.id || !checkoutUrl) {
    console.error("[create-subscription] Respuesta inesperada de Mercado Pago:", created);
    return Response.json(
      { error: "Mercado Pago no devolvió una URL de pago." },
      { status: 502 },
    );
  }

  // 5. Registrar la suscripción como pendiente (rol de servicio: ver migración 006).
  const { error: updateError } = await admin
    .from("profiles")
    .update({ subscription_status: "pending", mp_preapproval_id: created.id })
    .eq("id", user.id);

  if (updateError) {
    // El checkout ya existe en Mercado Pago: no se aborta el flujo. El webhook
    // sabe recuperar al usuario por `external_reference` aunque falte el id aquí.
    console.error(
      "[create-subscription] No se pudo guardar el id de la suscripción:",
      updateError,
    );
  }

  await admin.from("analytics_events").insert({
    user_id: user.id,
    event_type: "subscription_checkout_started",
    metadata: { preapproval_id: created.id, amount, currency: currencyId },
  });

  return Response.json({ checkoutUrl, preapprovalId: created.id });
}
