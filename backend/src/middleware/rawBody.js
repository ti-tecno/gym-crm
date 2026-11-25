/**
 * `verify` para express.json(): conserva el cuerpo crudo (Buffer) en req.rawBody solo para
 * las rutas indicadas (webhooks firmados). El resto de la app usa el mismo parser y el
 * mismo límite de tamaño sin guardar copia.
 */
export function guardarCuerpoCrudoPara(...urls) {
  const permitidas = new Set(urls);
  return (req, _res, buf) => {
    if (permitidas.has(req.originalUrl.split('?')[0])) req.rawBody = buf;
  };
}
