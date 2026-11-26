import sodium from 'libsodium-wrappers';
import {
  KEY_BYTES,
  contentData,
  managerKeyData,
  openAead,
  requireLength,
  requireText,
  sealAead,
  type EncryptionContext,
  type StoredCiphertext,
} from './format.js';
import { sealForRecovery } from './recovery.js';

/** What to store for a manager: both are opaque, versioned byte strings. */
export interface ManagerKey {
  /** The manager data key, wrapped by the installation master key. */
  readonly wrappedKey: Uint8Array;
  /** The same data key, sealed to the admin recovery public key. */
  readonly recoveryKey: Uint8Array;
}

export interface RotatedManagerKey extends ManagerKey {
  /** The re-encrypted ciphertexts, in the order they were given. */
  readonly ciphertexts: readonly Uint8Array[];
}

export async function generateMasterKey(): Promise<Uint8Array> {
  await sodium.ready;
  return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
}

function seal(
  managerKey: Uint8Array,
  ownerId: string,
  masterKey: Uint8Array,
  recovery: Uint8Array,
) {
  return {
    wrappedKey: sealAead(managerKey, managerKeyData(ownerId), masterKey),
    recoveryKey: sealForRecovery(managerKey, ownerId, recovery),
  };
}

function withManagerKey<T>(
  wrappedKey: Uint8Array,
  ownerId: string,
  masterKey: Uint8Array,
  use: (managerKey: Uint8Array) => T,
): T {
  requireText(ownerId, 'ownerId');
  requireLength(masterKey, KEY_BYTES, 'master key');
  const managerKey = openAead(wrappedKey, managerKeyData(ownerId), masterKey);
  try {
    return use(managerKey);
  } finally {
    sodium.memzero(managerKey);
  }
}

function withNewManagerKey<T>(use: (managerKey: Uint8Array) => T): T {
  const managerKey = sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
  try {
    return use(managerKey);
  } finally {
    sodium.memzero(managerKey);
  }
}

export async function generateManagerKey(
  masterKey: Uint8Array,
  ownerId: string,
  recoveryPublicKey: Uint8Array,
): Promise<ManagerKey> {
  await sodium.ready;
  requireText(ownerId, 'ownerId');
  requireLength(masterKey, KEY_BYTES, 'master key');
  return withNewManagerKey((managerKey) => seal(managerKey, ownerId, masterKey, recoveryPublicKey));
}

export async function encrypt(
  plaintext: string | Uint8Array,
  wrappedKey: Uint8Array,
  masterKey: Uint8Array,
  context: EncryptionContext,
): Promise<Uint8Array> {
  await sodium.ready;
  requireText(context.purpose, 'purpose');
  return withManagerKey(wrappedKey, context.ownerId, masterKey, (managerKey) =>
    sealAead(plaintext, contentData(context), managerKey),
  );
}

/** The caller owns the returned plaintext: zero it with `fill(0)` once used. */
export async function decrypt(
  ciphertext: Uint8Array,
  wrappedKey: Uint8Array,
  masterKey: Uint8Array,
  context: EncryptionContext,
): Promise<Uint8Array> {
  await sodium.ready;
  requireText(context.purpose, 'purpose');
  return withManagerKey(wrappedKey, context.ownerId, masterKey, (managerKey) =>
    openAead(ciphertext, contentData(context), managerKey),
  );
}

/** Master key rotation: wraps the same manager key under the new master key; data is untouched. */
export async function rewrapManagerKey(
  wrappedKey: Uint8Array,
  ownerId: string,
  oldMasterKey: Uint8Array,
  newMasterKey: Uint8Array,
): Promise<Uint8Array> {
  await sodium.ready;
  requireLength(newMasterKey, KEY_BYTES, 'master key');
  return withManagerKey(wrappedKey, ownerId, oldMasterKey, (managerKey) =>
    sealAead(managerKey, managerKeyData(ownerId), newMasterKey),
  );
}

/**
 * Manager key rotation: decrypts every given ciphertext, then encrypts them under a fresh
 * manager key. All or nothing: one unreadable ciphertext fails the whole call. Store the new
 * wrapped key, recovery key and every returned ciphertext in one transaction.
 */
export async function rotateManagerKey(
  wrappedKey: Uint8Array,
  masterKey: Uint8Array,
  ownerId: string,
  recoveryPublicKey: Uint8Array,
  items: readonly StoredCiphertext[],
): Promise<RotatedManagerKey> {
  await sodium.ready;
  const opened: { plaintext: Uint8Array; context: EncryptionContext }[] = [];
  try {
    withManagerKey(wrappedKey, ownerId, masterKey, (managerKey) => {
      for (const item of items) {
        requireText(item.purpose, 'purpose');
        const context = { ownerId, purpose: item.purpose };
        opened.push({
          plaintext: openAead(item.ciphertext, contentData(context), managerKey),
          context,
        });
      }
    });
    return withNewManagerKey((managerKey) => ({
      ...seal(managerKey, ownerId, masterKey, recoveryPublicKey),
      ciphertexts: opened.map(({ plaintext, context }) =>
        sealAead(plaintext, contentData(context), managerKey),
      ),
    }));
  } finally {
    for (const { plaintext } of opened) sodium.memzero(plaintext);
  }
}
