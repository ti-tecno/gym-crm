import { randomUUID } from 'node:crypto';

export default function requestId(req, res, next) {
  const id = req.header('X-Request-Id') || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
