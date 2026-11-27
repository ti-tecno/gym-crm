# Recordatorio de pago por WhatsApp

IronCore manda recordatorios de pago por WhatsApp a través de **SofIA Messenger API** (es una "app cliente" del mensajero; ver `docs/SPEC.md` del mensajero, §4, §6, §7 y §12). **El objetivo del recordatorio es mandarle al cliente la liga para pagar.**

- **A quién:** clientes cuyo `gym_clientes.vencimiento` cae 3 días después de hoy, hoy, o hace 3 días (zona `America/Mexico_City`). No se envía a quien no tiene teléfono, no tiene monto o tiene un pago `Exitoso` en `gym_pagos` dentro de los 15 días previos al vencimiento. Como todo pago exitoso mueve el vencimiento (ver `docs/PAGO_EN_LINEA.md`), quien paga deja de recibir recordatorios de ese periodo.
- **Cuándo:** tarea diaria dentro del proceso del backend, a `RECORDATORIO_PAGO_HORA`. Recepción y admin también pueden enviar a mano desde Clientes → Recordatorios.
- **Interruptor:** Backoffice → Mensajería (solo ADMIN). Se guarda en `gym_settings` (`mensajeria.activo`) y **arranca apagado**. Apagado no se envía nada, ni automático ni manual, ni el mensaje de pago recibido. Se lee antes de cada envío.
- **Registro:** `gym_recordatorios`, con `recordatorioId` = `idempotencyKey` = `pago:<clienteId>:<vencimiento>:<etapa>`. Sin índices ni tablas nuevas.
- **Liga para pagar:** cada recordatorio lleva un botón **"Pagar ahora"** que abre `https://iron-core.mx/pagar/<token>` (página pública, sin iniciar sesión, que manda a Mercado Pago; ver `docs/PAGO_EN_LINEA.md`). El token va en `parameters.buttonUrlSuffix`, lleva el `clienteId` y una expiración (vencimiento + 75 días, o hoy + 75 si ya venció) firmados con HMAC-SHA256 y `LIGA_PAGO_SECRET`; sirve toda la secuencia de recordatorios de ese vencimiento. **Sin `LIGA_PAGO_SECRET` no se envía ningún recordatorio** (Backoffice → Mensajería lo marca como configuración faltante).
- **Pago recibido:** tras cada pago que queda `Exitoso` (mostrador o Mercado Pago) sale `ironcore_pago_recibido`, con el mismo interruptor. Se registra en `gym_recordatorios` con `recordatorioId` = `idempotencyKey` = `pagorecibido:<folio>` y `origen: 'pago_recibido'`. Un fallo del mensajero nunca afecta al pago.
- **Dos interruptores:** el de IronCore (arriba) y el de SofIA en el mensajero (`active` de la app; apagado, toda llamada con la llave responde `403 CLIENT_DISABLED`). **Para que salga cualquier mensaje deben estar encendidos los dos.** Backoffice → Mensajería muestra el de SofIA en solo lectura consultando `GET /v1/me` (timeout de 4 s; si falla dice "sin conexión" sin romper la pestaña). Si SofIA no lo ha activado, el envío queda `Fallido` con motivo "Servicio de mensajería no activado por SofIA", **reintentable**: la corrida del día se detiene y se reintenta cada hora.
- **Respuestas de clientes:** el webhook también procesa `message.received`. La respuesta se liga al cliente por `ref` (`cliente:<id>`, que el entrante hereda del último saliente) y se guarda en `gym_clientes.respuestasWhatsapp` (texto, fecha, nombre de perfil, a qué mensaje respondió, atendida; las 20 más recientes; un evento repetido no se duplica porque se usa `data.id`). Recepción la ve en Clientes → Recordatorios, puede marcarla atendida y tiene "Registrar pago" a un clic. **Una respuesta ("ya pagué") no cambia nada por sí sola**: solo un pago real renueva y detiene los recordatorios, y al registrarse ese pago las respuestas pendientes del cliente se dan por atendidas. Un entrante sin `ref` (alguien a quien nunca se le escribió) no se puede ligar y se ignora. IronCore no responde por WhatsApp.

## Variables de entorno (`backend/.env`)

Todas opcionales. Si falta alguna de conexión, el backend arranca igual y la función queda apagada, con un aviso en el log y en Backoffice → Mensajería.

| Variable | Valor |
|---|---|
| `MENSAJERO_URL` | Base del mensajero, p. ej. `https://<host>` (con o sin `/v1`) |
| `MENSAJERO_API_KEY` | `apiKey` (`msk_…`) de la app IronCore en el mensajero |
| `MENSAJERO_WEBHOOK_SECRET` | `webhookSecret` de esa app (sin él, el webhook responde 503: no se ven entregados/leídos ni respuestas) |
| `MENSAJERO_CANAL` | `default` (vacío = canal por defecto de la app) |
| `RECORDATORIO_PAGO_PLANTILLA_ANTES` | `ironcore_pago_por_vencer_liga` |
| `RECORDATORIO_PAGO_PLANTILLA_HOY` | `ironcore_pago_vence_hoy_liga` |
| `RECORDATORIO_PAGO_PLANTILLA_DESPUES` | `ironcore_pago_vencido_liga` |
| `RECORDATORIO_PAGO_IDIOMA` | `es_MX` |
| `RECORDATORIO_PAGO_ETAPAS` | `-3,0,3` (días relativos al vencimiento; negativo = antes) |
| `RECORDATORIO_PAGO_HORA` | `09:00` (HH:MM, hora de México) |
| `LIGA_PAGO_SECRET` | Secreto aleatorio de **al menos 32 caracteres** para firmar las ligas (p. ej. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`). Cambiarlo invalida las ligas ya enviadas |
| `PAGO_RECIBIDO_PLANTILLA` | `ironcore_pago_recibido` (valor por defecto) |

## Plantillas de Meta

Las tres plantillas **sin botón** (`ironcore_pago_por_vencer`, `ironcore_pago_vence_hoy`, `ironcore_pago_vencido`) quedaron **obsoletas**: se reemplazan por las de abajo, con botón URL. Hay que esperar a que estén `APPROVED` antes de encender el envío. El JSON es **referencia**, por si hay que volver a crearlas (`POST /v1/admin/templates` del mensajero, con la llave de admin). Las variables `nombre`, `monto` y `fecha` las arma `parametrosPlantilla` (`backend/src/services/recordatorioPago.logic.js`) y el sufijo del botón es el token de la liga (`buttonUrlSuffix`).

```json
{
  "channel": "default",
  "name": "ironcore_pago_por_vencer_liga",
  "language": "es_MX",
  "category": "UTILITY",
  "parameter_format": "NAMED",
  "components": [
    {
      "type": "BODY",
      "text": "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía vence el {{fecha}}. El monto de tu renovación es de {{monto}}. Puedes pagar en línea con el botón de abajo o en recepción. Si ya realizaste tu pago, ignora este mensaje.",
      "example": { "body_text_named_params": [
        { "param_name": "nombre", "example": "Carlos" },
        { "param_name": "fecha", "example": "lunes 30 de noviembre" },
        { "param_name": "monto", "example": "$850" }
      ] }
    },
    { "type": "BUTTONS", "buttons": [ { "type": "URL", "text": "Pagar ahora", "url": "https://iron-core.mx/pagar/{{1}}", "example": ["AQAAAAAAAEAAgAAAAAAAAAFRe-yWeaICyPLPFsa7KjWvXto"] } ] }
  ]
}
```

- `ironcore_pago_vence_hoy_liga`: igual, con el texto "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía vence hoy, {{fecha}}. El monto de tu renovación es de {{monto}}. Puedes pagar en línea con el botón de abajo o en recepción. Si ya realizaste tu pago, ignora este mensaje."
- `ironcore_pago_vencido_liga`: igual, con el texto "Hola {{nombre}}, te escribimos de IronCore Gym. Tu membresía venció el {{fecha}} y tiene un pago pendiente de {{monto}}. Puedes regularizarla en línea con el botón de abajo o en recepción. Si ya realizaste tu pago, ignora este mensaje."
- `ironcore_pago_recibido` (sin cambios, sin botón): "Hola {{nombre}}, te escribimos de IronCore Gym. Recibimos tu pago de {{monto}} con folio {{folio}}. Tu membresía está vigente hasta el {{fecha}}. Conserva este mensaje como comprobante."

## Puesta en marcha

1. **Registrar IronCore en el mensajero** (llave de admin):
   `POST /v1/admin/clients` con `{ "name": "IronCore", "webhookUrl": "https://<api-de-ironcore>/api/v1/webhooks/mensajero", "dailyLimit": 100 }`. Guarda la `apiKey` y el `webhookSecret` (se muestran una sola vez). Luego asígnale el canal: `PUT /v1/admin/clients/<id>/channels` con `{ "channels": [{ "slug": "default", "isDefault": true }] }`.
   El `dailyLimit` es el tope de gasto si algo se descontrola; ajústalo al número de clientes.
2. **Esperar plantillas `APPROVED`** (`GET /v1/admin/console/channels/default/templates`).
3. **Configurar `backend/.env`** del servidor con las variables de arriba (incluido `LIGA_PAGO_SECRET`) y las de `docs/PAGO_EN_LINEA.md`, y reiniciar el backend (pm2, un solo proceso). En el log debe aparecer `[recordatorio-pago] Tarea diaria lista…`. Comprobar que el mensajero alcanza la `webhookUrl` (HTTPS pública) y que IronCore alcanza `MENSAJERO_URL`.
4. **Revisar antes de encender:** Backoffice → Mensajería muestra si la conexión está completa, si SofIA activó el servicio y la lista exacta de a quién le toca hoy. Los datos de clientes son antiguos: corrige teléfonos y vencimientos dudosos antes.
5. **Encender** en Backoffice → Mensajería. Si ya pasó la hora configurada, la corrida del día sale en el siguiente minuto.

Para apagarlo de inmediato: Backoffice → Mensajería → "Apagar envío" (la corrida en curso se detiene antes del siguiente mensaje).

## Envío automático diario (segundo interruptor)

Backoffice → Mensajería tiene dos interruptores, ambos apagados al inicio:

- **Envío** (`mensajeria.activo`): permite que salga cualquier WhatsApp de IronCore.
- **Envío automático diario** (`mensajeria.automatico`): permite la corrida diaria a todos los clientes en etapa.

Con el primero encendido y el segundo apagado, IronCore solo envía los recordatorios que alguien manda a una
persona con el botón "Enviar" de Clientes → Recordatorios (y el mensaje de pago recibido). La corrida diaria
responde `solo_manual` y no envía nada. `PUT /settings/admin/mensajeria` acepta `{ activo }` y/o `{ automatico }`.
