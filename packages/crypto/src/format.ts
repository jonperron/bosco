import sodium from 'libsodium-wrappers';

/** First byte of every wrapped key, recovery key and ciphertext. */
export const FORMAT_VERSION = 1;
export const KEY_BYTES = 32;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;

export interface EncryptionContext {
  /** The manager who owns the data key. */
  readonly ownerId: string;
  /**
   * What the data is and which record holds it, for example `one-on-one-note:<id>`. Including
   * the record id stops a ciphertext from being moved to another row of the same owner.
   */
  readonly purpose: string;
}

/** A ciphertext as stored, with the purpose it was encrypted under. */
export interface StoredCiphertext {
  readonly ciphertext: Uint8Array;
  readonly purpose: string;
}

export class CryptoError extends Error {
  override name = 'CryptoError';
}

/** Every public entry point awaits this, so a WASM load failure is a CryptoError too. */
export async function sodiumReady(): Promise<void> {
  try {
    await sodium.ready;
  } catch (error) {
    throw new CryptoError('libsodium failed to initialise', { cause: error });
  }
}

export function requireLength(bytes: Uint8Array, length: number, label: string): void {
  if (bytes.length !== length) {
    throw new CryptoError(`${label} must be ${length} bytes`);
  }
}

export function requireText(value: string, label: string): void {
  if (value.length === 0) {
    throw new CryptoError(`${label} must not be empty`);
  }
}

// JSON keeps the fields apart ("a","b,c" != "a,b","c") and the label separates key from data.
export const managerKeyData = (ownerId: string) =>
  JSON.stringify(['bosco', FORMAT_VERSION, 'manager-key', ownerId]);

export const contentData = (context: EncryptionContext) =>
  JSON.stringify(['bosco', FORMAT_VERSION, 'data', context.ownerId, context.purpose]);

export function withVersion(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + body.length);
  out[0] = FORMAT_VERSION;
  out.set(body, 1);
  return out;
}

export function readVersioned(data: Uint8Array, minBodyLength: number): Uint8Array {
  if (data.length < 1 + minBodyLength) {
    throw new CryptoError('malformed input: too short');
  }
  if (data[0] !== FORMAT_VERSION) {
    throw new CryptoError(`unsupported format version ${data[0]}`);
  }
  return data.subarray(1);
}

/** version || nonce || XChaCha20-Poly1305(message, associatedData) */
export function sealAead(
  message: string | Uint8Array,
  associatedData: string,
  key: Uint8Array,
): Uint8Array {
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const body = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    message,
    associatedData,
    null,
    nonce,
    key,
  );
  const payload = new Uint8Array(NONCE_BYTES + body.length);
  payload.set(nonce);
  payload.set(body, NONCE_BYTES);
  return withVersion(payload);
}

export function openAead(sealed: Uint8Array, associatedData: string, key: Uint8Array): Uint8Array {
  const payload = readVersioned(sealed, NONCE_BYTES + TAG_BYTES);
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      payload.subarray(NONCE_BYTES),
      associatedData,
      payload.subarray(0, NONCE_BYTES),
      key,
    );
  } catch (error) {
    throw new CryptoError('decryption failed: wrong key, context or tampered data', {
      cause: error,
    });
  }
}
