# Suscripciones con Mercado Pago (Chile · CLP)

Integración de la **Membresía Premium**: suscripción mensual recurrente de
**$4.990 CLP** que desbloquea las 86 lecciones del programa.

---

## 1. Cómo funciona

```
Usuario en /pricing
      │  POST /api/mercadopago/create-subscription
      ▼
Servidor  ──► Mercado Pago: crea `preapproval` (external_reference = user.id)
      │       guarda mp_preapproval_id y subscription_status = 'pending'
      ▼
Redirección al checkout (init_point) ──► el usuario autoriza el cobro
      │
      ▼
Mercado Pago ──► POST /api/webhooks/mercadopago
                       │  vuelve a consultar la suscripción a la API
                       ▼
                 subscription_status = 'active'  (rol de servicio)
```

Dos decisiones de seguridad que conviene no revertir:

- **El acceso solo lo concede el webhook.** La vuelta del checkout al navegador
  (`back_url`) nunca activa nada: la controla el usuario y es falsificable. Por
  eso al volver se muestra "estamos confirmando tu pago".
- **El cuerpo del webhook nunca se toma como verdad.** De él solo se lee el ID;
  el estado real se re-consulta a la API de Mercado Pago con nuestro access
  token. Una notificación falsificada no puede activar nada que no exista.

Además, las columnas de suscripción de `profiles` están blindadas por el trigger
`protect_subscription_columns()` (migración 006). Sin él, la política RLS
`profiles_update_own` permitiría que cualquier usuario escribiera
`subscription_status = 'active'` desde el navegador con la anon key.

---

## 2. Puesta en marcha

### 2.1 Base de datos

Aplica la migración en **Supabase Dashboard → SQL Editor**:

```
Docs/migrations/006_add_subscriptions.sql
```

Es idempotente. Añade a `profiles`: `subscription_status` (NOT NULL DEFAULT
`'free'`, así los usuarios nuevos entran en gratuito solos), `mp_preapproval_id`,
`mp_payer_id` y `current_period_end`.

### 2.2 Variables de entorno

Ver `.env.example`. Las nuevas:

| Variable | Ámbito | Para qué |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | servidor | Crear la suscripción y consultar su estado |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | público | Identifica la cuenta en el navegador |
| `MERCADOPAGO_WEBHOOK_SECRET` | servidor | Validar la firma `x-signature` del webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | Escribir el estado de pago sin sesión de usuario |
| `NEXT_PUBLIC_SITE_URL` | público | Construir la `back_url` del checkout |

⚠️ `SUPABASE_SERVICE_ROLE_KEY` y `MERCADOPAGO_ACCESS_TOKEN` **nunca** deben
llevar el prefijo `NEXT_PUBLIC_`.

Las credenciales salen de **Mercado Pago → Tus integraciones → tu aplicación →
Credenciales**. Las de prueba empiezan por `TEST-` y activan un aviso de "modo de
prueba" en `/pricing`.

### 2.3 Webhook

En **Tus integraciones → tu aplicación → Webhooks**, configura:

- **URL:** `https://tu-dominio.com/api/webhooks/mercadopago`
- **Eventos:** `Suscripciones` (`subscription_preapproval`) y `Pagos` (`payment`)
- Copia la **clave secreta** a `MERCADOPAGO_WEBHOOK_SECRET`

En local, expón el puerto con un túnel (`ngrok http 3000`) y usa esa URL.

Si `MERCADOPAGO_WEBHOOK_SECRET` está vacía, el webhook sigue funcionando pero no
valida la firma y lo registra como advertencia en consola. Configúrala.

---

## 3. Muro de pago

La regla vive en `src/lib/progression.ts` y la usan tanto el dashboard (pintar
candados) como la página de la lección (proteger la URL), para que no puedan
discrepar.

- **Sin suscripción:** el primer módulo de cada categoría y, como mínimo, sus 3
  primeras lecciones (`FREE_LESSONS_PER_CATEGORY`). Hoy son **6 de 86**.
- **Con suscripción activa:** progresión secuencial normal sobre las 86.

Hay dos candados distintos y se ven distinto:

| | Candado | Etiqueta | Al pulsar |
|---|---|---|---|
| Falta estudiar | 🔒 | "Bloqueada" | Nada (atenuada, sin enlace) |
| Falta suscripción | 👑 | "Membresía Premium 👑" | `/pricing?leccion=<slug>` |

Entrar por URL directa a una lección de pago redirige a `/pricing`; a una
bloqueada por avance, al dashboard con su aviso.

**Al cancelar**, el acceso se conserva hasta `current_period_end` (el mes ya
pagado). Vencido eso, las lecciones de pago vuelven a bloquearse aunque el
estudiante ya las hubiera empezado.

---

## 4. Probar la integración

1. Configura credenciales `TEST-` y un usuario de prueba comprador
   (Mercado Pago → Tus integraciones → Cuentas de prueba).
2. Entra a `/pricing` y pulsa **Suscribirse con Mercado Pago**.
3. Paga en el checkout con la cuenta de prueba y una
   [tarjeta de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/test/cards).
4. Comprueba en Supabase que `profiles.subscription_status` pasó a `'active'`.
5. Recarga `/dashboard`: las 86 lecciones deben seguir la progresión secuencial
   sin etiquetas 👑.

Si el estado se queda en `'pending'`, revisa el registro de notificaciones en el
panel de Mercado Pago y los logs del servidor (`[webhook/mercadopago] …`).

---

## 5. Archivos

| Archivo | Rol |
|---|---|
| `src/lib/subscription.ts` | Plan, estados y reglas de acceso (sin acoplar a la pasarela) |
| `src/lib/mercadopago.ts` | Configuración del SDK y traducción de estados |
| `src/lib/progression.ts` | Muro de pago + avance secuencial |
| `src/lib/supabase/admin.ts` | Cliente con rol de servicio (solo servidor) |
| `src/app/api/mercadopago/create-subscription/route.ts` | Crea/recupera el checkout |
| `src/app/api/webhooks/mercadopago/route.ts` | Recibe y concilia las notificaciones |
| `src/app/pricing/page.tsx` · `src/components/Pricing.tsx` | Página de precios |
| `Docs/migrations/006_add_subscriptions.sql` | Migración |
