import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML antes de renderizarlo con dangerouslySetInnerHTML.
 * USO:
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(input) }} />
 *
 * IMPORTANTE: por defecto React ya escapa el contenido renderizado con {}.
 * Sólo usa esto si REALMENTE necesitas inyectar markup confiable (ej. CMS).
 */
export function sanitizeHtml(dirty) {
  if (typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
  });
}

/** Sanitiza texto plano simple (quita tags y atributos peligrosos). */
export function sanitizeText(dirty) {
  if (typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
