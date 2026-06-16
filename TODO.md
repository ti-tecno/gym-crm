- [x] Agregar variables TLS opcionales en `backend/src/config/env.js`.
- [x] Actualizar `backend/src/server.js` para levantar HTTPS cuando existan cert/key.
- [x] Mantener fallback HTTP cuando no existan cert/key.
- [x] Marcar tareas completadas.

- [x] Actualizar paleta en `frontend/src/constants/theme.js` con los nuevos colores solicitados.
- [x] Alinear estilos globales en `frontend/src/index.css` con la nueva paleta.
- [x] Marcar tareas de theming como completadas.

- [x] Agregar dataset y sección de carrusel de coaches en `frontend/src/pages/LandingPage.jsx`.
- [x] Implementar navegación del carrusel (autoplay, prev/next, indicadores) responsive.
- [x] Integrar estilos del carrusel con la paleta del proyecto.
- [x] Marcar tareas del carrusel como completadas.

- [x] Crear tabla/configuración `settings` en backend (Dynamo + createTables).
- [x] Implementar repositorio/controlador/rutas de `settings` (public + admin packages/schedule/calendar).
- [x] Registrar rutas `settings` en `backend/src/routes/index.js`.
- [x] Agregar `settingsService` en frontend.
- [x] Crear página admin `BackofficeContenido.jsx` (tabs: Paquetes, Horarios, Calendario).
- [x] Agregar ruta protegida ADMIN para backoffice de contenido.
- [x] Agregar acceso en sidebar solo para ADMIN.
- [x] Extender backoffice para planes con período (mensual/anual), alta/baja de planes y edición de color/id.
- [x] Actualizar backend de settings para persistir/normalizar `periodo` en paquetes.
- [ ] Mantener estilo actual del Backoffice y agregar opciones de edición de Horarios en formato tabla (filas + clases + colores).
- [ ] Conectar `LandingPage.jsx` a `/settings/public` para cargar planes dinámicos y mostrar período configurable.
- [ ] Ejecutar validación rápida (build/lint) y marcar tareas completadas.
- [x] Cambiar logout en Sidebar a redirección "/".
- [x] Cambiar logout en ClienteSidebar a redirección "/".
- [ ] Validación critical-path de logout -> landing.
