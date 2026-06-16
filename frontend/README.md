# IronCore — Frontend (React + Vite)

SPA en React (JSX) que consume la API DynamoDB-backed del backend.

## Setup

```bash
cp .env.example .env       # ajusta VITE_API_URL si tu backend no está en 4000
npm install
npm run dev                # http://localhost:5173
npm run build              # build de producción a /dist
npm run preview            # sirve /dist para QA
```

## Variables de entorno

**Sólo** las que empiezan con `VITE_` se inyectan en el bundle. Nunca pongas secretos: todo lo prefijado `VITE_` es público y visible para el cliente.

| Variable        | Descripción                          | Ejemplo                         |
|-----------------|--------------------------------------|---------------------------------|
| `VITE_API_URL`  | URL base de la API                   | `http://localhost:4000/api/v1`  |
| `VITE_APP_NAME` | Nombre mostrado en la UI             | `IronCore`                         |

## Estructura

```
src/
├── main.jsx              # Bootstrap React + Router + AuthProvider
├── App.jsx               # Rutas (con ProtectedRoute + RBAC)
├── index.css             # Reset + scrollbars
├── constants/theme.js    # Paleta de colores + NAV_ITEMS + ROLES
├── components/
│   ├── ui/               # StatCard, Badge, Avatar, SectionHeader, TabBar, FInput
│   └── layout/           # Sidebar, Layout
├── context/AuthContext.jsx
├── guards/ProtectedRoute.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Clientes/         # index + Lista + RegistroAutonomo + PagoEnLinea + Recordatorios
│   ├── Inventario.jsx
│   ├── Nomina.jsx
│   ├── RutinasClientes.jsx
│   └── RutinasCoach.jsx
├── services/
│   ├── api.js            # Axios + interceptores (Bearer, CSRF, refresh, backoff)
│   ├── auth.service.js   # login, logout, /me, bootstrapSession
│   └── modules.service.js
└── utils/
    ├── sanitize.js       # DOMPurify (sanitizeHtml / sanitizeText)
    ├── safeRoute.js      # isSafeRoute / isWhitelistedRoute / safeNext
    ├── tokenStore.js     # JWT en memoria (NO localStorage)
    └── format.js
```

## Seguridad

- **JWT access en memoria** (`tokenStore`) — nunca tocamos `localStorage`/`sessionStorage`.
- **Refresh** vía cookie `HttpOnly + SameSite=Strict + Secure` (set por el backend).
- **CSRF** double-submit: backend manda `csrfToken` cookie + valor en JSON; el cliente lo reenvía como `X-CSRF-Token` en todas las mutaciones (axios lo automatiza).
- **Refresh silencioso** ante 401, **retry exponencial** ante 5xx/red.
- **DOMPurify** en `utils/sanitize.js`. **No usamos `dangerouslySetInnerHTML`** en el código (todo renderiza con `{ ... }`, que React escapa automáticamente). Si llegas a necesitarlo, usa `sanitizeHtml()`.
- **Validación de formularios** con `react-hook-form` + `zod` (login, registro autónomo, tarjeta).
- **Rate limit cliente** en login: 3 intentos / 60 s + delay progresivo.
- **Sólo se envían `cardLast4`** al backend; el PAN, CVV y vencimiento de tarjeta no salen del componente.
- **CSP estricta** en `index.html` (en producción mejor servir el header desde infra).
- **`safeRoute.js`** valida URLs/rutas de routing antes de procesarlas (whitelist + protocolos permitidos).
- **`ProtectedRoute`** verifica sesión activa y RBAC; el access token se valida por `exp` antes de usarse.

## Auditoría de dependencias

```bash
npm audit --omit=dev          # alertas críticas/altas en prod
npm outdated                  # versiones disponibles
```
