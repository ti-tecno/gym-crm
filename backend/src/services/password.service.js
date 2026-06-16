import bcrypt from 'bcrypt';
import env from '../config/env.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
