import { z } from 'zod';

// Pago cobrado en mostrador. Ningún dato de tarjeta pasa por aquí: la tarjeta se cobra en la
// terminal del gimnasio y solo se registra el método. El estado siempre es Exitoso y renueva.
export const pagoCreateSchema = z.object({
  clienteId: z.string().uuid(),
  // Opcional: si no viene se usa la mensualidad registrada del cliente.
  monto: z.number().positive().max(1_000_000).optional(),
  metodo: z.enum(['efectivo', 'transferencia', 'tarjeta']),
  // Folio del voucher de la terminal o referencia de la transferencia.
  referencia: z.string().trim().max(40).regex(/^[\w\s#./-]*$/, 'Solo letras, números y - _ # . /').optional(),
});

export const pagoQuery = z.object({
  clienteId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const vistaPreviaQuery = z.object({
  clienteId: z.string().uuid(),
});

const pagoIdSchema = z.string().regex(/^(TXN-[0-9A-F]{4,16}|MP-\d{1,20})$/);

export const miPagoParams = z.object({ pagoId: pagoIdSchema });

// Token de la liga pública (ver services/ligaPago.logic.js: base64url de 47 caracteres).
const tokenLiga = z.string().regex(/^[A-Za-z0-9_-]{47}$/);
export const ligaParams = z.object({ token: tokenLiga });
export const ligaPagoParams = z.object({ token: tokenLiga, pagoId: pagoIdSchema });
