import crypto from 'crypto';

/**
 * SP800-108 Key Derivation using HMACSHA512 (ASP.NET 4.5+ MachineKey.Protect)
 */
function deriveKey(masterKey, primaryPurpose, specificPurposes) {
  let context = Buffer.alloc(0);
  if (specificPurposes) {
    for (const purpose of specificPurposes) {
      const purposeBuffer = Buffer.from(purpose, 'utf8');
      context = Buffer.concat([context, Buffer.from([purposeBuffer.length]), purposeBuffer]);
    }
  }

  const labelBuffer = Buffer.from(primaryPurpose, 'utf8');
  const derivedKeyLength = masterKey.length;
  const hmac = crypto.createHmac('sha512', masterKey);

  const counterBuffer = Buffer.alloc(4);
  counterBuffer.writeUInt32BE(1, 0);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(derivedKeyLength * 8, 0);

  hmac.update(counterBuffer);
  hmac.update(labelBuffer);
  hmac.update(Buffer.alloc(1));
  hmac.update(context);
  hmac.update(lengthBuffer);

  return hmac.digest().subarray(0, derivedKeyLength);
}

/** ASP.NET UrlToken (Base64Url with trailing pad-count digit) */
export function urlTokenDecode(input) {
  if (!input) return null;
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padCount = parseInt(base64.charAt(base64.length - 1), 10);
  if (!isNaN(padCount) && padCount >= 0 && padCount <= 2) {
    base64 = base64.substring(0, base64.length - 1);
    for (let i = 0; i < padCount; i++) base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Decrypts a token from ASP.NET 4.5+ MachineKey.Protect("UserInfo")
 * Returns the decrypted pipe-delimited string: "Username|DisplayName|UCode|UID|UserType"
 */
export function decryptMachineKeyToken(token, decryptionKeyHex) {
  try {
    if (!decryptionKeyHex || !token) return null;

    const decryptionKey = Buffer.from(decryptionKeyHex, 'hex');
    const rawBytes = urlTokenDecode(token);
    if (!rawBytes || rawBytes.length < 48) return null;

    const ivLength = 16;
    const sigLength = 32; // HMACSHA256
    const iv = rawBytes.subarray(0, ivLength);
    const ciphertext = rawBytes.subarray(ivLength, rawBytes.length - sigLength);

    const primaryPurpose = 'User.MachineKey.Protect';
    const specificPurposes = ['PS_Web_Application', 'UserInfo', 'v1'];

    const encKey = deriveKey(decryptionKey, primaryPurpose, specificPurposes);

    const decipher = crypto.createDecipheriv('aes-256-cbc', encKey.subarray(0, 32), iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[machineKey] decrypt error:', err.message);
    return null;
  }
}

/**
 * Extract Token=... value from raw Cookie header
 * Cookie format: "UserInfo=Token=xxx&Username=yyy; other=..."
 */
export function extractTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/Token=([^;&\s]+)/);
  return m ? m[1] : null;
}
