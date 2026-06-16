/**
 * Middleware de validación basada en Zod.
 * Uso: router.post('/x', validate({ body: schema, params: ..., query: ... }), handler)
 */
export function validate({ body, params, query } = {}) {
  return (req, _res, next) => {
    try {
      if (body)   req.body   = body.parse(req.body);
      if (params) req.params = params.parse(req.params);
      if (query)  req.query  = query.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}
