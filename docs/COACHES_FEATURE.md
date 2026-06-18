# Coaches Feature — Especificación

## Overview

Agregar sección de Coaches en el backoffice (Admin) para gestionar coaches del gimnasio con fotos. Las imágenes se guardan en el servidor en `backend/public/uploads/coaches/`.

---

## 1. Backend

### 1.1 Upload de imágenes (YA EXISTE)

**Endpoint:** `POST /api/v1/upload/coaches`
- **Auth:** `requireAuth`, `requireRole('ADMIN')`
- **Input:** `FormData` con campo `image` (archivo)
- **Response:** `{ url: "/uploads/coaches/{filename}" }`
- **Validaciones:**
  - Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - Tamaño máximo: 5 MB
  - Nombre de archivo: UUID + extensión

**Ubicación:** `backend/src/routes/upload.routes.js`

### 1.2 Settings API (YA EXISTE)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/settings/public` | Coaches (público) |
| GET | `/api/v1/settings/admin` | Coaches (admin) |
| PUT | `/api/v1/settings/admin/coaches` | Actualizar coaches |

**Estructura del coach:**
```json
{
  "id": "coach-1",
  "name": "Nombre del Coach",
  "role": "Rol/Especialidad",
  "desc": "Descripción",
  "image": "/uploads/coaches/uuid.jpg"
}
```

**Ubicación:** `backend/src/controllers/settings.controller.js`, `backend/src/repositories/settings.repo.js`

---

## 2. Frontend

### 2.1 Servicio (YA EXISTE)

**Archivo:** `frontend/src/services/modules.service.js`

```javascript
export const settingsService = {
  // ...existing methods
  admin: () => api.get('/settings/admin').then(r => r.data),
  updateCoaches: (coaches) => api.put('/settings/admin/coaches', { coaches }).then(r => r.data),
  uploadCoachImg: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/upload/coaches', form).then(r => r.data);
  },
};
```

### 2.2 Componente CoachesEditor (NUEVO)

**Ubicación:** `frontend/src/components/CoachesEditor.jsx`

**Funcionalidades:**
1. **Listado de coaches** — Grid de cards con foto, nombre, rol, descripción
2. **Agregar coach** — Formulario con campos: nombre, rol, descripción, imagen
3. **Editar coach** — Click en card para editar
4. **Eliminar coach** — Botón en card
5. **Subir imagen** — Input file que llama a `settingsService.uploadCoachImg()`

**UI/UX:**
- Grid de 3 columnas (responsive: 2 en tablet, 1 en móvil)
- Card: imagen circular/ovalada (120x120), nombre en negrita, rol en muted, descripción truncada
- Hover: mostrar botones de editar/eliminar
- Modal o inline edit para formulario

### 2.3 Integración en BackofficeContenido

**Archivo:** `frontend/src/pages/BackofficeContenido.jsx`

**Cambios:**
- El tab "Coaches" ya existe pero está básico
- Reemplazar contenido actual con `<CoachesEditor />`
- El componente debe manejar estado local y llamadas al servicio

---

## 3. Flujo de Usuario

### 3.1 Agregar Coach

1. Admin entra a `/admin/contenido` → tab "Coaches"
2. Click en "+ Agregar Coach"
3. Llena formulario: nombre, rol, descripción
4. (Opcional) Sube imagen → se hace upload a `/upload/coaches`
5. Click "Guardar" → PUT a `/settings/admin/coaches`
6. Se actualiza el listado

### 3.2 Editar Coach

1. Click en card de coach
2. Se abre formulario con datos actuales
3. Modifica campos
4. (Opcional) Cambia imagen
5. Click "Guardar"

### 3.3 Eliminar Coach

1. Click en botón eliminar en card
2. Confirmación (opcional)
3. Se elimina del array y se guarda

---

## 4. Estructura de Datos

### Coach Object

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|------------|
| `id` | string | Sí | ID único (auto-generado) |
| `name` | string | Sí | Nombre completo |
| `role` | string | Sí | Especialidad/rol |
| `desc` | string | No | Descripción |
| `image` | string | No | URL de imagen (`/uploads/coaches/...`) |

---

## 5. Validaciones

### Backend (Zod)

```javascript
const coachSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(80).trim(),
  role: z.string().min(2).max(60).trim(),
  desc: z.string().max(500).trim().optional(),
  image: z.string().url().optional(),
});
```

### Frontend

- Nombre: requerido, 2-80 caracteres
- Rol: requerido, 2-60 caracteres
- Descripción: opcional, max 500
- Imagen: solo tipos jpg/png/webp/gif, max 5MB

---

## 6. Archivos a Modificar/Crear

### Backend
- **YA EXISTE:** `backend/src/routes/upload.routes.js` (no cambiar)
- **YA EXISTE:** `backend/src/controllers/settings.controller.js` (no cambiar)
- **YA EXISTE:** `backend/src/repositories/settings.repo.js` (no cambiar)

### Frontend
- **NUEVO:** `frontend/src/components/CoachesEditor.jsx`
- **MODIFICAR:** `frontend/src/pages/BackofficeContenido.jsx` (integrar CoachesEditor)
- **YA EXISTE:** `frontend/src/services/modules.service.js` (no cambiar)

---

## 7. Serve Static Files

El backend debe servir archivos estáticos desde `backend/public/`.

**Verificar en `backend/src/app.js`:**
```javascript
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
```

---

## 8. Testing

### Manual

1. **Upload de imagen:**
   ```bash
   curl -X POST http://localhost:4000/api/v1/upload/coaches \
     -H "Authorization: Bearer <token>" \
     -F "image=@foto.jpg"
   ```

2. **Get coaches:**
   ```bash
   curl http://localhost:4000/api/v1/settings/admin \
     -H "Authorization: Bearer <token>"
   ```

3. **Update coaches:**
   ```bash
   curl -X PUT http://localhost:4000/api/v1/settings/admin/coaches \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"coaches":[{"id":"c1","name":"Test","role":"Rol","image":"/uploads/coaches/test.jpg"}]}'
   ```

### Frontend

1. Ir a `/admin/contenido` → tab "Coaches"
2. Agregar coach con/sin imagen
3. Editar coach
4. Eliminar coach
5. Verificar que aparece en landing page (público)

---

## 9. Dependencias

### Backend (YA INSTALADO)
- `multer` — en `backend/package.json`
- `uuid` — en `backend/package.json`

### Frontend
- No requiere nuevas dependencias
- Usa `settingsService` existente

---

## 10. Notas

- Las imágenes se guardan en `backend/public/uploads/coaches/`
- El endpoint de upload YA funciona, solo hay que crear la UI
- El array de coaches ya se guarda en DynamoDB (tabla `gym_settings`)
- No hay migración de DB necesaria