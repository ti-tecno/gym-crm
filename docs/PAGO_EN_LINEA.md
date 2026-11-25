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
| `CREDENCIALES_LLAVE_MAESTRA` | Opcional. Llave para cifrar las credenciales capturadas en el Backoffice (ver abajo). Sin ella, solo funcionan las de entorno |
| `OTP_PLANTILLA` / `OTP_IDIOMA` | Plantilla de autenticación del código por WhatsApp (por defecto `ironcore_codigo_verificacion` / `es_MX`) |

El token y la clave secreta también se pueden capturar desde el Backoffice (siguiente sección); esas tienen prioridad sobre las variables.

## Configurar las credenciales desde el Backoffice

**Backoffice de Contenido → pestaña "Mercado Pago"** (solo ADMIN) permite capturar el Access Token y la clave secreta de webhooks sin tocar el servidor. Muestra si el pago en línea está configurado, **de dónde salen** las credenciales (Backoffice o variables de entorno), si son de **prueba** (`TEST-`) o de **producción** (`APP_USR-`), los **últimos 4** caracteres de cada una (nunca el valor completo, tampoco en la API) y la **URL del webhook** que hay que pegar en el panel de Mercado Pago.

- **Prioridad:** si hay credenciales guardadas en el Backoffice se usan esas; si no, las de `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET`. `PUBLIC_API_URL`, `PUBLIC_FRONTEND_URL` y el descriptor siempre salen del entorno. El cambio surte efecto en la siguiente operación, **sin reiniciar** (`obtenerConfigMercadoPago()` en `backend/src/services/pagos.js` lee `gym_settings` en cada llamada).
- **Solo se valida el formato** (`APP_USR-…`/`TEST-…`; clave de ≥16 letras o números). No se consulta a Mercado Pago al guardar: después haz un pago de prueba.
- **Cifrado en reposo:** AES-256-GCM (`node:crypto`) con la llave de `CREDENCIALES_LLAVE_MAESTRA` y el nombre del campo como dato asociado. Sin esa variable la pestaña lo explica y no deja guardar (las de entorno siguen funcionando).
- **Código por WhatsApp obligatorio:** guardar o borrar credenciales y cambiar el teléfono exigen un código de 6 dígitos que llega al **teléfono del administrador del sitio** (se registra en la misma pestaña). Ver abajo.
- **Borrar** las guardadas regresa a las variables de entorno (si las hay; si no, el pago en línea se apaga).

### La llave maestra (`CREDENCIALES_LLAVE_MAESTRA`)

32 bytes aleatorios en base64 (44 caracteres) o hex (64): `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Va solo en `backend/.env` del servidor (nunca con prefijo `VITE_`, nunca en el repositorio) y conviene guardar una copia en un gestor de contraseñas. Requiere reiniciar el backend.

**Si se pierde o se cambia:** las credenciales guardadas quedan ilegibles. El backend **no se cae ni usa otras**: Mercado Pago queda "no configurado" (no aparece el botón de pagar y el webhook responde 503, así que Mercado Pago reintenta los avisos) y la pestaña muestra el aviso con los últimos 4 guardados. Para recuperarse: poner una llave (la misma si apareció, o una nueva), **borrar** las guardadas desde la pestaña (borrar no necesita la llave) y volver a capturarlas desde el panel de Mercado Pago. Un dato alterado en la base de datos se comporta igual (lo detecta la autenticación de GCM).

### Teléfono del administrador y código de un solo uso

- **Primera vez:** celular mexicano con WhatsApp + la **contraseña actual** del admin → llega un código a ese número → se confirma. Cuentas que solo entran con Google no tienen contraseña y no pueden hacer el alta.
- **Cambio:** código al **número actual** → con ese código y el número nuevo se envía otro código al **número nuevo** → se confirma. Si el envío al nuevo falla, se empieza de nuevo (el primer código ya se usó).
- **Reglas del código:** 6 dígitos con azar criptográfico; se guarda solo su HMAC-SHA256 (con sal y una "pimienta" derivada de la llave privada del JWT, que no está en la BD); vale **10 minutos**, **un solo uso**, **5 intentos** y luego se invalida; **1 reenvío por minuto** y **5 solicitudes por hora** por usuario (las contraseñas incorrectas cuentan); ligado al usuario, a la operación y al número destino; comparación en tiempo constante; un código nuevo invalida el anterior. El código se manda **en la misma petición** que hace el cambio: verificarlo autoriza esa operación y nada más. Toda escritura es condicional por versión: dos verificaciones simultáneas no pueden usar el mismo código.
- **Envío:** `POST /v1/messages/template` del mensajero con la plantilla de autenticación `OTP_PLANTILLA` (por defecto `ironcore_codigo_verificacion`, `es_MX`) y `parameters: { otpCode }`. **No depende del interruptor de Mensajería** (ese es para los mensajes a clientes), pero sí de que el mensajero esté configurado y de que SofIA tenga activa la app. Si no se puede enviar (mensajero sin configurar, app apagada por SofIA, número sin WhatsApp, plantilla aún no aprobada, límite diario, mensajero caído) la pantalla lo dice y no queda ningún código válido pendiente. **No hay camino alterno sin código.**
- **Auditoría:** el log registra quién pidió un código y para qué, intentos incorrectos y quién cambió credenciales o teléfono (`[seguridad] …`), con el teléfono enmascarado y sin secretos ni códigos.

### Dónde se guarda

En `gym_settings`, en ítems **aparte** del de contenido (`global-settings`), así guardar Paquetes u otra pestaña nunca los borra y `GET /settings/public` / `GET /settings/admin` nunca los devuelven. Sin índices ni tablas nuevas.

| `settingsId` | Contenido |
|---|---|
| `sitio-seguridad` | `adminTelefono` (+52…, en claro), quién/cuándo lo cambió; `mercadoPago`: `accessTokenCifrado`, `webhookSecretCifrado` (formato `v1.<idLlave>.<iv>.<tag>.<cifrado>`), últimos 4 de cada una, `modoPrueba`, `llaveId`, quién/cuándo; `version` |
| `otp-admin#<userId>` | código vigente de ese admin: `hash`, `sal`, `accion`, `destino`, `expiraAt`, `intentos`, `estado` (`pendiente`/`usado`/`agotado`/`anulado`), `telefonoAnterior` (en un cambio), solicitudes de la última hora; `version` |

Endpoints (todos `ADMIN`; los de cambio con CSRF), bajo `/api/v1/settings/admin/seguridad`: `GET /` (estado) · `POST /codigo` `{ accion: mp_guardar | mp_borrar | telefono_cambiar }` · `PUT /mercadopago` `{ accessToken, webhookSecret, codigo }` · `POST /mercadopago/borrar` `{ codigo }` · `POST /telefono/codigo` `{ telefono, password }` o `{ telefono, codigo }` · `PUT /telefono` `{ telefono, codigo }`.

### Si el administrador pierde su teléfono

No hay forma de saltarse el código desde la aplicación (a propósito). Quien tenga acceso a DynamoDB (consola de AWS) quita el atributo `adminTelefono` del ítem `sitio-seguridad` de `gym_settings` (sin tocar `mercadoPago`); después un ADMIN registra el número nuevo con su contraseña. Mientras tanto Mercado Pago sigue funcionando con las credenciales que ya estaban guardadas.

## Panel de Mercado Pago (Tus integraciones → tu aplicación)

1. **Webhooks → Configurar notificaciones**, en *Modo productivo* (y en *Modo de prueba* para probar): URL `https://<api>/api/v1/webhooks/mercadopago`, evento **Pagos** (`payment`). Guardar y copiar la **clave secreta** a `MERCADOPAGO_WEBHOOK_SECRET` (o capturarla en Backoffice → Mercado Pago, que muestra esta URL lista para copiar).
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
