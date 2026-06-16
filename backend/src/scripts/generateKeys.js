import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'keys');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const priv = path.join(dir, 'jwt_private.pem');
const pub  = path.join(dir, 'jwt_public.pem');

if (fs.existsSync(priv) || fs.existsSync(pub)) {
  console.error('Las claves ya existen. Borra backend/keys/ para regenerarlas.');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(priv, privateKey, { mode: 0o600 });
fs.writeFileSync(pub, publicKey, { mode: 0o644 });

console.log('✓ Par RSA generado en backend/keys/');
console.log('  - jwt_private.pem (mantén privada, NO commitear)');
console.log('  - jwt_public.pem');
