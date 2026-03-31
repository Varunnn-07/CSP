const crypto = require('crypto');

const CBC_ALGORITHM = 'aes-256-cbc';
const LEGACY_GCM_ALGORITHM = 'aes-256-gcm';
const LEGACY_GCM_PREFIX = 'v1';
const KEY = process.env.MFA_SECRET_ENCRYPTION_KEY;

if (!KEY) {
  throw new Error('MFA secret encryption key missing');
}

if (Buffer.byteLength(KEY, 'utf8') < 32) {
  throw new Error('MFA secret encryption key must be at least 32 characters long');
}

const AES_CBC_KEY = Buffer.from(KEY, 'utf8').slice(0, 32);
const LEGACY_GCM_KEY = crypto.createHash('sha256').update(KEY).digest();

function encryptMfaSecret(plainSecret) {
  const normalizedSecret = String(plainSecret || '').trim();

  if (!normalizedSecret) {
    throw new Error('MFA secret cannot be empty');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    CBC_ALGORITHM,
    AES_CBC_KEY,
    iv
  );

  let encrypted = cipher.update(normalizedSecret);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptLegacyGcmSecret(value) {
  const parts = value.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted MFA secret format');
  }

  const [, ivPart, tagPart, dataPart] = parts;
  const decipher = crypto.createDecipheriv(
    LEGACY_GCM_ALGORITHM,
    LEGACY_GCM_KEY,
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final()
  ]);

  return plain.toString('utf8');
}

function decryptMfaSecret(storedSecret) {
  const value = String(storedSecret || '').trim();

  if (!value) {
    return null;
  }

  if (value.startsWith(`${LEGACY_GCM_PREFIX}:`)) {
    return decryptLegacyGcmSecret(value);
  }

  const parts = value.split(':');

  if (parts.length === 2) {
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');

    const decipher = crypto.createDecipheriv(
      CBC_ALGORITHM,
      AES_CBC_KEY,
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  }

  // Backward compatibility for older plaintext secrets.
  return value;
}

module.exports = {
  encryptMfaSecret,
  decryptMfaSecret
};
