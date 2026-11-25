# Recordatorio de pago por WhatsApp

IronCore manda recordatorios de pago por WhatsApp a través de **SofIA Messenger API** (es una "app cliente" del mensajero; ver `docs/SPEC.md` del mensajero, §4, §7 y §12).

- **A quién:** clientes cuyo `gym_clientes.vencimiento` cae 3 días después de hoy, hoy, o hace 3 días (zona `America/Mexico_City`). No se envía a quien no tiene teléfono, no tiene monto o tiene un pago `Exitoso` en `gym_pagos` dentro de los 15 días previos al vencimiento.
- **Cuándo:** tarea diaria dentro del proceso del backend, a `RECORDATORIO_PAGO_HORA`. Recepción y admin también pueden enviar a mano desde Clientes → Recordatorios.
- **Interruptor:** Backoffice → Mensajería (solo ADMIN). Se guarda en `gym_settings` (`mensajeria.activo`) y **arranca apagado**. Apagado no se envía nada, ni automático ni manual. Se lee antes de cada envío.
- **Registro:** `gym_recordatorios`, con `recordatorioId` = `idempotencyKey` = `pago:<clienteId>:<vencimiento>:<etapa>`. Sin índices ni tablas nuevas.

## Variables de entorno (`backend/.env`)

Todas opcionales. Si falta alguna de conexión, el backend arranca igual y la función queda apagada, con un aviso en el log y en Backoffice → Mensajería.

| Variable | Valor |
|---|---|
| `MENSAJERO_URL` | Base del mensajero, p. ej. `https://<host>` (con o sin `/v1`) |
| `MENSAJERO_API_KEY` | `apiKey` (`msk_…`) de la app IronCore en el mensajero |
| `MENSAJERO_WEBHOOK_SECRET` | `webhookSecret` de esa app (sin él, el webhook responde 503 y los estados se quedan en "Enviado") |
| `MENSAJERO_CANAL` | `default` (vacío = canal por defecto de la app) |
| `RECORDATORIO_PAGO_PLANTILLA_ANTES` | `ironcore_pago_por_vencer` |
| `RECORDATORIO_PAGO_PLANTILLA_HOY` | `ironcore_pago_vence_hoy` |
| `RECORDATORIO_PAGO_PLANTILLA_DESPUES` | `ironcore_pago_vencido` |
| `RECORDATORIO_PAGO_IDIOMA` | `es_MX` |
| `RECORDATORIO_PAGO_ETAPAS` | `-3,0,3` (días relativos al vencimiento; negativo = antes) |
| `RECORDATORIO_PAGO_HORA` | `09:00` (HH:MM, hora de México) |

## Plantillas de Meta

**Ya creadas** en el canal `default` (quedaron en revisión, `PENDING`). Hay que esperar a que estén `APPROVED` antes de encender el envío. El JSON siguiente es solo **referencia**, por si hay que volver a crearlas en otra cuenta de WhatsApp Business (`POST /v1/admin/templates` del mensajero, con la llave de admin). Las variables `nombre`, `monto` y `fecha` son exactamente las que arma el backend (`parametrosPlantilla` en `backend/src/services/recordatorioPago.logic.js`).

```json
{
  "channel": "default",
  "name": "ironcore_pago_por_vencer",
  "language": "es_MX",
  "category": "UTILITY",
  "parameter_format": "NAMED",
  "components": [{
    "type": "BODY",
    "text": "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía vence el {{fecha}}. El monto de tu renovación es de {{monto}}. Puedes pagar en recepción. Si ya realizaste tu pago, ignora este mensaje.",
    "example": { "body_text_named_params": [
      { "param_name": "nombre", "example": "Carlos" },
      { "param_name": "fecha", "example": "lunes 30 de noviembre" },
      { "param_name": "monto", "example": "$850" }
    ] }
  }]
}
```

```json
{
  "channel": "default",
  "name": "ironcore_pago_vence_hoy",
  "language": "es_MX",
  "category": "UTILITY",
  "parameter_format": "NAMED",
  "components": [{
    "type": "BODY",
    "text": "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía vence hoy, {{fecha}}. El monto de tu renovación es de {{monto}}. Puedes pagar en recepción. Si ya realizaste tu pago, ignora este mensaje.",
    "example": { "body_text_named_params": [
      { "param_name": "nombre", "example": "Carlos" },
      { "param_name": "fecha", "example": "lunes 30 de noviembre" },
      { "param_name": "monto", "example": "$850" }
    ] }
  }]
}
```

```json
{
  "channel": "default",
  "name": "ironcore_pago_vencido",
  "language": "es_MX",
  "category": "UTILITY",
  "parameter_format": "NAMED",
  "components": [{
    "type": "BODY",
    "text": "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía venció el {{fecha}} y tiene un pago pendiente de {{monto}}. Puedes regularizarla en recepción. Si ya realizaste tu pago, ignora este mensaje.",
    "example": { "body_text_named_params": [
      { "param_name": "nombre", "example": "Carlos" },
      { "param_name": "fecha", "example": "lunes 30 de noviembre" },
      { "param_name": "monto", "example": "$850" }
    ] }
  }]
}
```

## Puesta en marcha

1. **Registrar IronCore en el mensajero** (llave de admin):
   `POST /v1/admin/clients` con `{ "name": "IronCore", "webhookUrl": "https://<api-de-ironcore>/api/v1/webhooks/mensajero", "dailyLimit": 100 }`. Guarda la `apiKey` y el `webhookSecret` (se muestran una sola vez). Luego asígnale el canal: `PUT /v1/admin/clients/<id>/channels` con `{ "channels": [{ "slug": "default", "isDefault": true }] }`.
   El `dailyLimit` es el tope de gasto si algo se descontrola; ajústalo al número de clientes.
2. **Esperar plantillas `APPROVED`** (`GET /v1/admin/console/channels/default/templates`).
3. **Configurar `backend/.env`** del servidor con las variables de arriba y reiniciar el backend (pm2, un solo proceso). En el log debe aparecer `[recordatorio-pago] Tarea diaria lista…`. Comprobar que el mensajero alcanza la `webhookUrl` (HTTPS pública) y que IronCore alcanza `MENSAJERO_URL`.
4. **Revisar antes de encender:** Backoffice → Mensajería muestra si la conexión está completa y la lista exacta de a quién le toca hoy. Los datos de clientes son antiguos: corrige teléfonos y vencimientos dudosos antes.
5. **Encender** en Backoffice → Mensajería. Si ya pasó la hora configurada, la corrida del día sale en el siguiente minuto.

Para apagarlo de inmediato: Backoffice → Mensajería → "Apagar envío" (la corrida en curso se detiene antes del siguiente mensaje).
