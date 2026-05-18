# Lista de verificación de seguridad — GymOS

Antes de desplegar a producción cada item debe estar marcado.

## Frontend
- [x] JWT en memoria (nunca en localStorage/sessionStorage)
- [x] Refresh token en cookie HTTP-only + SameSite=Strict
- [x] DOMPurify aplicado a cualquier HTML dinámico
- [x] Sin `dangerouslySetInnerHTML` sin sanitización previa
- [x] React Hook Form + Zod en formularios
- [x] Rate limiting cliente con debounce (3 intentos/min) en login
- [x] Axios con interceptores y exponential backoff
- [x] Validación de respuestas con Zod
- [x] Variables expuestas sólo con prefijo `VITE_` (públicas)
- [x] CSP estricta declarada en `index.html`
- [x] Validador de URLs/rutas confiables (`safeRoute.js`)
- [x] ProtectedRoute con verificación de expiración + RBAC
- [ ] `npm audit` limpio
- [ ] Subresource Integrity (SRI) en CDNs (cuando se añadan)

## Backend
- [x] Helmet con CSP, HSTS, frameguard DENY, nosniff, Referrer-Policy strict-origin
- [x] CORS whitelist + credentials sólo para orígenes confiables
- [x] express-rate-limit por IP + ruta `/auth` con bloqueo progresivo
- [x] JWT RS256 (claves asimétricas, no HS256)
- [x] Access token 15 min, refresh token 7d rotado en cada uso
- [x] bcrypt con saltRounds = 12
- [x] Zod schema en cada endpoint
- [x] DynamoDB con expresiones parametrizadas (`ExpressionAttributeValues`)
- [x] express.json({ limit: '100kb' }) para payload máx
- [x] Winston JSON con redacción de password/token/cc
- [x] Sin stack traces en producción
- [x] Bloqueo temporal tras 5 intentos fallidos
- [x] requestId con UUID por request (trazabilidad)
- [x] /api/v1 versionado
- [x] Timeout 30s default
- [x] Helmet `hidePoweredBy`
- [ ] HTTPS forzado con redirect 301 (config infra)
- [ ] TLS 1.3, cipher suites modernos (config infra)
- [ ] Secrets en AWS Secrets Manager, rotación periódica
- [ ] Test OWASP ZAP previo a release
