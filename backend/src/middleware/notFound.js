export default function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado', code: 'NOT_FOUND', path: req.originalUrl, requestId: req.id });
}
