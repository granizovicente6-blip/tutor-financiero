import {
  InvalidWebhookSignatureError,
  Payment,
  WebhookSignatureValidator,
} from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMercadoPagoConfig,
  getPreApprovalClient,
  toSubscriptionStatus,
} from "@/lib/mercadopago";
import type { SubscriptionStatus } from "@/lib/types";

/**
 * API Route: POST /api/webhooks/mercadopago
 *
 * Receptor de las notificaciones de Mercado Pago. Es la ÚNICA vía por la que se
 * concede el acceso Premium: la vuelta del checkout al navegador no se usa para
 * nada porque el usuario la controla y es falsificable.
 *
 * Eventos que atiende:
 *  - `subscription_preapproval` — cambió el estado de la suscripción.
 *  - `payment`                  — se cobró (o falló) una cuota; se resuelve la
 *                                 suscripción a la que pertenece y se sincroniza.
 * El resto se ignora con 200 (Mercado Pago reintenta lo que no responda 2xx).
 *
 * Regla de seguridad: el cuerpo de la notificación NUNCA se toma como verdad.
 * De él solo se lee el ID; el estado real se vuelve a consultar a la API de
 * Mercado Pago con nuestro access token. Una notificación falsificada, por
 * tanto, no puede activar una suscripción que no exista de verdad.
 *
 * Códigos de respuesta:
 *  - 200 procesada o ignorada (Mercado Pago no reintenta).
 *  - 401 firma inválida.
 *  - 500 fallo transitorio (Mercado Pago reintenta más tarde).
 */

/** Tolerancia del reloj para la firma; acota la ventana de repetición. */
const SIGNATURE_TOLERANCE_SECONDS = 600;

/** Cuerpo de la notificación (solo se usa para saber QUÉ consultar). */
interface WebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/** Fin del período pagado por defecto: un mes desde ahora. */
function oneMonthFromNow(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

/**
 * Consulta la suscripción en Mercado Pago y refleja su estado real en `profiles`.
 * Devuelve `true` si se pudo procesar (o si no había nada que hacer).
 */
async function syncPreapproval(preapprovalId: string): Promise<boolean> {
  const admin = createAdminClient();
  const preapproval = await getPreApprovalClient().get({ id: preapprovalId });

  // El usuario viaja en `external_reference` desde que se creó la suscripción.
  // Si faltara (suscripción creada fuera de la app), se busca por el id guardado.
  let userId = preapproval.external_reference ?? null;
  if (!userId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("mp_preapproval_id", preapprovalId)
      .maybeSingle();
    userId = (data?.id as string | undefined) ?? null;
  }

  if (!userId) {
    console.warn(
      "[webhook/mercadopago] Suscripción sin usuario asociado, se ignora:",
      preapprovalId,
    );
    return true; // No es un error transitorio: reintentar no cambiaría nada.
  }

  const status: SubscriptionStatus = toSubscriptionStatus(preapproval.status);

  // Con la suscripción al día, el acceso llega hasta el próximo cobro. Si se
  // canceló, se conserva el `current_period_end` que ya hubiera (el mes pagado).
  const update: Record<string, unknown> = {
    subscription_status: status,
    mp_preapproval_id: preapprovalId,
    mp_payer_id: preapproval.payer_id != null ? String(preapproval.payer_id) : null,
  };
  if (status === "active") {
    update.current_period_end = preapproval.next_payment_date ?? oneMonthFromNow();
  }

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) {
    console.error("[webhook/mercadopago] No se pudo actualizar el perfil:", error);
    return false; // Transitorio: que Mercado Pago reintente.
  }

  if (status === "active" || status === "cancelled") {
    await admin.from("analytics_events").insert({
      user_id: userId,
      event_type:
        status === "active" ? "subscription_activated" : "subscription_cancelled",
      metadata: { preapproval_id: preapprovalId, mp_status: preapproval.status },
    });
  }

  console.info(
    `[webhook/mercadopago] Suscripción ${preapprovalId} -> ${status} (usuario ${userId}).`,
  );
  return true;
}

/**
 * Un pago suelto no dice a qué suscripción pertenece hasta consultarlo: Mercado
 * Pago devuelve el `preapproval_id` en los metadatos de los pagos recurrentes.
 * Si el pago no pertenece a una suscripción, no hay nada que hacer.
 */
async function syncFromPayment(paymentId: string): Promise<boolean> {
  const payment = await new Payment(getMercadoPagoConfig()).get({ id: paymentId });

  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const preapprovalId =
    (metadata.preapproval_id as string | undefined) ??
    (metadata.preapprovalId as string | undefined);

  if (!preapprovalId) {
    console.info(
      "[webhook/mercadopago] Pago sin suscripción asociada, se ignora:",
      paymentId,
    );
    return true;
  }

  // Se sincroniza contra la suscripción, no contra el pago: así el estado que
  // acaba en la base de datos es siempre el que Mercado Pago considera vigente.
  return syncPreapproval(preapprovalId);
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // --- 1. Validar la firma (capa extra; la de fondo es re-consultar la API) ---
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId: url.searchParams.get("data.id"),
        secret,
        toleranceSeconds: SIGNATURE_TOLERANCE_SECONDS,
      });
    } catch (error) {
      const reason =
        error instanceof InvalidWebhookSignatureError ? error.reason : "Desconocido";
      console.error("[webhook/mercadopago] Firma inválida:", reason);
      return Response.json({ error: "Firma inválida." }, { status: 401 });
    }
  } else {
    console.warn(
      "[webhook/mercadopago] MERCADOPAGO_WEBHOOK_SECRET sin configurar: " +
        "no se está validando la firma de las notificaciones.",
    );
  }

  // --- 2. Identificar el evento -------------------------------------------
  let body: WebhookBody = {};
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    // Algunas notificaciones antiguas llegan solo con query string.
  }

  // `type` es el formato actual; `topic` el heredado. El id puede venir en el
  // cuerpo (`data.id`) o en la URL (`data.id` / `id`).
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const resourceId = String(
    body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "",
  );

  if (!type || !resourceId) {
    console.warn("[webhook/mercadopago] Notificación sin tipo o sin id, se ignora.");
    return Response.json({ received: true, handled: false }, { status: 200 });
  }

  // --- 3. Procesar ---------------------------------------------------------
  try {
    let handled: boolean;

    switch (type) {
      case "subscription_preapproval":
      case "preapproval":
        handled = await syncPreapproval(resourceId);
        break;

      case "payment":
        handled = await syncFromPayment(resourceId);
        break;

      default:
        // `subscription_authorized_payment`, `plan`, etc.: no cambian el estado
        // por sí solos; el evento de suscripción o de pago sí llegará.
        console.info("[webhook/mercadopago] Evento ignorado:", type);
        return Response.json({ received: true, handled: false }, { status: 200 });
    }

    if (!handled) {
      // Fallo transitorio: 500 hace que Mercado Pago reintente la notificación.
      return Response.json({ error: "Reintentar." }, { status: 500 });
    }

    return Response.json({ received: true, handled: true }, { status: 200 });
  } catch (error) {
    console.error("[webhook/mercadopago] Error procesando la notificación:", error);
    return Response.json({ error: "Error interno." }, { status: 500 });
  }
}

/**
 * Mercado Pago comprueba la URL con un GET al configurar el webhook en el panel.
 * Se responde 200 sin exponer nada.
 */
export async function GET(): Promise<Response> {
  return Response.json({ status: "ok" }, { status: 200 });
}
