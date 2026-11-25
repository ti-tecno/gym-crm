# Pago en línea (Mercado Pago) y renovación de membresía

- **Recepción** registra pagos cobrados en mostrador (efectivo, transferencia, tarjeta en la terminal) en Clientes → Registrar pago. Quedan `Exitoso` al instante. Ahí no se captura ningún dato de tarjeta.
- **El cliente** paga en línea con **Checkout Pro** (redirección a la página de Mercado Pago: tarjeta, OXXO, SPEI) desde su portal (Mi Membresía → Pagar) o desde la **liga pública** `https://iron-core.mx/pagar/<token>` que va en el botón del recordatorio por WhatsApp (sin iniciar sesión; ver `docs/RECORDATORIO_PAGO.md`). Ningún dato de tarjeta pasa por IronCore. **El monto y el concepto los decide el backend** con el cliente autenticado (o el de la liga), nunca el navegador.
- **Todo pago que queda `Exitoso` renueva la membresía una sola vez** (`gym_clientes.vencimiento` y `estado`) y manda el WhatsApp `ironcore_pago_recibido` si el envío está encendido (Backoffice → Mensajería).

## Regla de renovación

Meses del periodo: `tipoMensualidad` (Mensual 1, 3 Meses 3, 6 Meses 6, Anual 12); si no hay, el `plan` (Mensual/Estudiante 1, Trimestre 3, Semestre 6, Anual 12); si tampoco, 1.
- Membresía **vigente** (vence el día del pago o después): se extiende desde el vencimiento actual.
- **Vencida** o sin fecha: desde el día del pago (zona `America/Mexico_City`; en línea, el día en que Mercado Pago acreditó el pago).
- Fin de mes: si el día no existe en el mes destino se usa el último (31 ene + 1 mes = 28/29 feb).
- Estado: `Vencido` si ya pasó, `Por vencer` a 7 días o menos, `Activo` después.
- El cambio del pago y del vencimiento se escriben en **una transacción** de DynamoDB condicionada (el pago sin renovación previa y el vencimiento como se leyó), así un aviso repetido o simultáneo nunca renueva dos veces.

## Variables de entorno (`backend/.env`)

Todas opcionales: si falta alguna, el pago en línea queda apagado (no aparece el botón y el backend responde `503 PAGO_EN_LINEA_NO_CONFIGURADO`), con aviso en el log y en Backoffice → Mensajería. El servidor arranca igual. **Nunca** con prefijo `VITE_`.

| Variable | Valor |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de la aplicación (Tus integraciones → Credenciales). De prueba o de producción |
| `MERCADOPAGO_WEBHOOK_SECRET` | "Clave secreta" de Tus integraciones → Webhooks (se genera al guardar la configuración) |
| `PUBLIC_API_URL` | URL pública **HTTPS** del backend, sin `/api/v1` (p. ej. `https://api.iron-core.mx`). Arma `notification_url` |
| `PUBLIC_FRONTEND_URL` | URL pública **HTTPS** del frontend: `https://iron-core.mx`. Arma las URLs de regreso |
| `MERCADOPAGO_STATEMENT_DESCRIPTOR` | Opcional, ≤13 caracteres (por defecto `IRONCORE GYM`) |
| `LIGA_PAGO_SECRET` | Ver `docs/RECORDATORIO_PAGO.md` (firma las ligas `/pagar/<token>`) |

## Panel de Mercado Pago (Tus integraciones → tu aplicación)

1. **Webhooks → Configurar notificaciones**, en *Modo productivo* (y en *Modo de prueba* para probar): URL `https://<api>/api/v1/webhooks/mercadopago`, evento **Pagos** (`payment`). Guardar y copiar la **clave secreta** a `MERCADOPAGO_WEBHOOK_SECRET`.
2. Cada preferencia además manda su `notification_url` (`…/webhooks/mercadopago?source_news=webhooks`), que tiene prioridad sobre la del panel.
3. "Simular" del panel manda un id de pago inexistente: el backend lo verifica, consulta a Mercado Pago, recibe 404 y responde 200 sin hacer nada (sirve para comprobar firma y alcance).

## Cómo se verifica un aviso

`POST /api/v1/webhooks/mercadopago` (sin JWT ni CSRF):
1. Firma `x-signature: ts=…,v1=…`: HMAC-SHA256 (hex) con la clave secreta sobre `id:<data.id del query, en minúsculas>;request-id:<x-request-id>;ts:<ts>;` (se omite cada parte que no venga). Inválida → 401. Formato IPN viejo (`?topic=`, sin firma) → 200 sin procesar.
2. Solo `type=payment`. Se consulta `GET https://api.mercadopago.com/v1/payments/<id>` **con nuestro token**: si MP no responde → 503 (MP reintenta).
3. Se exige `external_reference` = folio local, `currency_id = MXN` y `transaction_amount` = monto del folio. Si no cuadra, el pago **no** se marca `Exitoso` y queda `requiereRevision` con el motivo.
4. Se aplica la transición de estado (abajo). Todo es idempotente: el mismo aviso puede llegar muchas veces.

## Estados del pago (`gym_pagos.estado`)

| Mercado Pago (`status`) | Local | Efecto |
|---|---|---|
| (checkout creado) | `Pendiente` | Folio `TXN-…` = `external_reference`; aún sin pago de MP ("Sin completar" en el historial) |
| `pending`, `in_process`, `authorized` | `Pendiente` | Ficha OXXO / SPEI esperando pago, o revisión |
| `approved` | `Exitoso` | Renueva + WhatsApp de pago recibido |
| `rejected` | `Rechazado` | Nada. Si después llega otro pago aprobado de la misma preferencia, el folio pasa a `Exitoso` |
| `cancelled` | `Cancelado` | Nada (ficha vencida, cancelado) |
| `refunded` | `Reembolsado` | Si nada movió el vencimiento después, se regresa al anterior; si no, queda `requiereRevision` |
| `charged_back` | `Contracargo` | Igual que reembolso |
| `in_mediation` | (sin cambio) | Disputa abierta; se espera el resultado |

Si una misma preferencia recibe **dos pagos aprobados** (el cliente pagó dos veces), el segundo se registra como folio `MP-<id de pago>` y también renueva (el dinero se recibió); se registra en el log para revisarlo.

Un doble clic en "Pagar" reusa el checkout creado en los últimos 30 minutos. La liga pública solo deja pagar si faltan 15 días o menos para el vencimiento (o ya venció); si no, dice que la membresía ya está pagada y remite a recepción.

## Cómo probar con credenciales de prueba

1. En Tus integraciones crea/usa una aplicación de Checkout Pro y **usuarios de prueba** (vendedor y comprador). Usa el Access Token de prueba en `MERCADOPAGO_ACCESS_TOKEN` (Backoffice → Mensajería avisa "credenciales de PRUEBA" si empieza con `TEST-`).
2. El backend debe ser alcanzable por HTTPS desde internet para recibir avisos (en local, un túnel HTTPS) y `PUBLIC_FRONTEND_URL` debe ser HTTPS (Mercado Pago descarta URLs de regreso HTTP).
3. Configura el webhook en *Modo de prueba* con la misma URL y pon esa clave secreta.
4. Entra como cliente → Mi Membresía → Pagar, inicia sesión en Mercado Pago con el **comprador de prueba** y paga con las tarjetas de prueba de la documentación (el nombre del titular decide el resultado: aprobado, rechazado, pendiente…). Prueba también OXXO.
5. Verifica: el folio pasa a `Exitoso` solo cuando llega el aviso; el vencimiento se movió una vez; reenviar el aviso desde el panel no lo vuelve a mover; la página de resultado muestra aprobado / pendiente / rechazado.
6. Pruebas automáticas (sin red ni BD): `cd backend && npm test`.

## Qué no hace

- No guarda ni ve datos de tarjeta. No cobra desde recepción (la terminal es aparte).
- No hace reembolsos desde IronCore (se hacen en el panel de Mercado Pago; el aviso los refleja).
- Si el proceso se cae justo después de confirmar un pago, el WhatsApp de pago recibido de ese pago puede no salir (el pago y la renovación sí quedan).
