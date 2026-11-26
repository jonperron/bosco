import sodium from 'libsodium-wrappers';
import {
  CryptoError,
  KEY_BYTES,
  contentData,
  managerKeyData,
  openAead,
  readVersioned,
  requireLength,
  requireText,
  sealAead,
  withVersion,
  type StoredCiphertext,
} from './format.js';

/**
 * The admin recovery key pair. Generate it offline; the API process only ever holds the public
 * key, and the private key is brought in for a recovery only.
 */
export interface RecoveryKeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
}

export async function generateRecoveryKeyPair(): Promise<RecoveryKeyPair> {
  await sodium.ready;
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  return { publicKey, privateKey };
}

/** version || crypto_box_seal(managerKey || ownerId, recoveryPublicKey) */
export function sealForRecovery(
  managerKey: Uint8Array,
  ownerId: string,
  recoveryPublicKey: Uint8Array,
): Uint8Array {
  requireLength(recoveryPublicKey, sodium.crypto_box_PUBLICKEYBYTES, 'recovery public key');
  const owner = sodium.from_string(ownerId);
  const message = new Uint8Array(KEY_BYTES + owner.length);
  message.set(managerKey);
  message.set(owner, KEY_BYTES);
  try {
    return withVersion(sodium.crypto_box_seal(message, recoveryPublicKey));
  } finally {
    sodium.memzero(message);
  }
}

/**
 * Opens a recovery key with the admin key pair and wraps the manager key again under
 * `masterKey` (the current or a replacement one). Returns the new wrapped key to store.
 *
 * A sealed box does not prove who sealed it: anyone with the public key and database write
 * access could plant a recovery key holding a data key they know. Pass one of the owner's
 * existing ciphertexts as `verify` so a planted key is refused.
 */
export async function recoverManagerKey(
  recoveryKey: Uint8Array,
  ownerId: string,
  recoveryKeyPair: RecoveryKeyPair,
  masterKey: Uint8Array,
  verify?: StoredCiphertext,
): Promise<Uint8Array> {
  await sodium.ready;
  requireText(ownerId, 'ownerId');
  requireLength(masterKey, KEY_BYTES, 'master key');
  const sealed = readVersioned(recoveryKey, sodium.crypto_box_SEALBYTES + KEY_BYTES);
  let message: Uint8Array;
  try {
    message = sodium.crypto_box_seal_open(
      sealed,
      recoveryKeyPair.publicKey,
      recoveryKeyPair.privateKey,
    );
  } catch (error) {
    throw new CryptoError('recovery failed: wrong key pair or tampered recovery key', {
      cause: error,
    });
  }
  try {
    if (sodium.to_string(message.subarray(KEY_BYTES)) !== ownerId) {
      throw new CryptoError('recovery failed: the recovery key belongs to another owner');
    }
    const managerKey = message.subarray(0, KEY_BYTES);
    if (verify) {
      const context = { ownerId, purpose: verify.purpose };
      sodium.memzero(openAead(verify.ciphertext, contentData(context), managerKey));
    }
    return sealAead(managerKey, managerKeyData(ownerId), masterKey);
  } finally {
    sodium.memzero(message);
  }
}
