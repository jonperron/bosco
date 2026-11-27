import { open } from 'node:fs/promises';
import sodium from 'libsodium-wrappers';
import { CryptoError, KEY_BYTES, requireLength, sodiumReady } from './format.js';

export const MASTER_KEY_FILE_ENV = 'BOSCO_MASTER_KEY_FILE';
// A 32-byte key is 44 base64 characters; the rest leaves room for whitespace.
const MAX_KEY_FILE_BYTES = 256;

async function readBounded(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(MAX_KEY_FILE_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Reads the installation master key from the file named by `BOSCO_MASTER_KEY_FILE`
 * (a file mounted in the container). The file holds the 32-byte key in standard base64,
 * for example the output of `openssl rand -base64 32`. Errors never include the key.
 */
export async function loadMasterKeyFromFile(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Uint8Array> {
  const path = env[MASTER_KEY_FILE_ENV];
  if (!path) {
    throw new CryptoError(
      `${MASTER_KEY_FILE_ENV} is not set: point it at the file holding the base64 master key`,
    );
  }
  // Before the read, so a failure here leaves no key bytes behind.
  await sodiumReady();
  let content: Buffer;
  try {
    content = await readBounded(path);
  } catch (error) {
    throw new CryptoError(`cannot read the master key file at ${path}`, { cause: error });
  }
  let key: Uint8Array;
  try {
    if (content.length > MAX_KEY_FILE_BYTES) {
      throw new CryptoError(
        `the master key file at ${path} is larger than ${MAX_KEY_FILE_BYTES} bytes`,
      );
    }
    key = sodium.from_base64(content.toString('utf8').trim(), sodium.base64_variants.ORIGINAL);
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    // The decoder's error is dropped on purpose: it must not carry the file content.
    throw new CryptoError(`the master key file at ${path} is not valid base64`);
  } finally {
    content.fill(0);
  }
  try {
    requireLength(key, KEY_BYTES, 'master key');
  } catch (error) {
    sodium.memzero(key);
    throw error;
  }
  return key;
}
