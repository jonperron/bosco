import sodium from 'libsodium-wrappers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CryptoError,
  FORMAT_VERSION,
  decrypt,
  encrypt,
  generateManagerKey,
  generateMasterKey,
  generateRecoveryKeyPair,
  recoverManagerKey,
  rewrapManagerKey,
  rotateManagerKey,
} from '../src/index.js';

const OWNER = 'manager-a';
const OTHER_OWNER = 'manager-b';
const NOTE = { ownerId: OWNER, purpose: 'one-on-one-note' };
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const flipByte = (bytes: Uint8Array, index: number) => {
  const copy = Uint8Array.from(bytes);
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
};

async function setup() {
  const masterKey = await generateMasterKey();
  const recovery = await generateRecoveryKeyPair();
  const { wrappedKey, recoveryKey } = await generateManagerKey(
    masterKey,
    OWNER,
    recovery.publicKey,
  );
  return { masterKey, wrappedKey, recovery, recoveryKey };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('encrypt / decrypt', () => {
  it('round-trips a string and bytes', async () => {
    const { masterKey, wrappedKey } = await setup();
    const fromString = await encrypt('private note', wrappedKey, masterKey, NOTE);
    expect(text(await decrypt(fromString, wrappedKey, masterKey, NOTE))).toBe('private note');

    const bytes = Uint8Array.of(0, 1, 2, 255);
    const fromBytes = await encrypt(bytes, wrappedKey, masterKey, NOTE);
    expect(await decrypt(fromBytes, wrappedKey, masterKey, NOTE)).toEqual(bytes);
  });

  it('does not contain the plaintext', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('private note', wrappedKey, masterKey, NOTE);
    expect(Buffer.from(ciphertext).includes('private note')).toBe(false);
    expect(ciphertext[0]).toBe(FORMAT_VERSION);
  });

  it('fails with the wrong master key', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('x', wrappedKey, masterKey, NOTE);
    const otherMaster = await generateMasterKey();
    await expect(decrypt(ciphertext, wrappedKey, otherMaster, NOTE)).rejects.toThrow(CryptoError);
  });

  it("fails with another manager's key", async () => {
    const { masterKey, wrappedKey, recovery } = await setup();
    const ciphertext = await encrypt('x', wrappedKey, masterKey, NOTE);
    const other = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
    await expect(decrypt(ciphertext, other.wrappedKey, masterKey, NOTE)).rejects.toThrow(
      CryptoError,
    );
  });

  it.each([
    ['version byte', 0],
    ['nonce', 5],
    ['body', 30],
    ['last byte (tag)', -1],
  ])('fails when the %s is tampered with', async (_label, position) => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('private note', wrappedKey, masterKey, NOTE);
    const index = position < 0 ? ciphertext.length + position : position;
    const tampered = flipByte(ciphertext, index);
    await expect(decrypt(tampered, wrappedKey, masterKey, NOTE)).rejects.toThrow(CryptoError);
  });

  it('fails when the purpose does not match (associated data)', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('x', wrappedKey, masterKey, NOTE);
    await expect(
      decrypt(ciphertext, wrappedKey, masterKey, { ...NOTE, purpose: 'other' }),
    ).rejects.toThrow(CryptoError);
  });

  it('fails when a ciphertext and its key are moved to another owner', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('x', wrappedKey, masterKey, NOTE);
    await expect(
      decrypt(ciphertext, wrappedKey, masterKey, { ...NOTE, ownerId: OTHER_OWNER }),
    ).rejects.toThrow(CryptoError);
  });

  it('keeps ownerId and purpose apart in the associated data', async () => {
    const { masterKey, recovery } = await setup();
    const { wrappedKey } = await generateManagerKey(masterKey, 'a', recovery.publicKey);
    const ciphertext = await encrypt('x', wrappedKey, masterKey, { ownerId: 'a', purpose: 'b,c' });
    await expect(
      decrypt(ciphertext, wrappedKey, masterKey, { ownerId: 'a', purpose: 'b' }),
    ).rejects.toThrow(CryptoError);
  });

  it('uses a fresh random nonce for every encryption', async () => {
    const { masterKey, wrappedKey } = await setup();
    const nonces = new Set<string>();
    for (let index = 0; index < 500; index += 1) {
      const ciphertext = await encrypt('same', wrappedKey, masterKey, NOTE);
      nonces.add(Buffer.from(ciphertext.subarray(1, 25)).toString('hex'));
    }
    expect(nonces.size).toBe(500);
  });

  it('rejects an unknown format version', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = Uint8Array.from(await encrypt('x', wrappedKey, masterKey, NOTE));
    ciphertext[0] = FORMAT_VERSION + 1;
    await expect(decrypt(ciphertext, wrappedKey, masterKey, NOTE)).rejects.toThrow(
      /unsupported format version/,
    );
    const wrapped = Uint8Array.from(wrappedKey);
    wrapped[0] = 0;
    await expect(encrypt('x', wrapped, masterKey, NOTE)).rejects.toThrow(
      /unsupported format version/,
    );
  });

  it('rejects truncated input', async () => {
    const { masterKey, wrappedKey } = await setup();
    await expect(decrypt(Uint8Array.of(1, 2), wrappedKey, masterKey, NOTE)).rejects.toThrow(
      /malformed/,
    );
    await expect(encrypt('x', wrappedKey.subarray(0, 10), masterKey, NOTE)).rejects.toThrow(
      /malformed/,
    );
  });

  it('does not accept a wrapped key as a ciphertext', async () => {
    const { masterKey, wrappedKey } = await setup();
    await expect(decrypt(wrappedKey, wrappedKey, masterKey, NOTE)).rejects.toThrow(CryptoError);
  });

  it('zeroes the unwrapped manager key after use', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('x', wrappedKey, masterKey, NOTE);
    const memzero = vi.spyOn(sodium, 'memzero');
    await decrypt(ciphertext, wrappedKey, masterKey, NOTE);
    expect(memzero).toHaveBeenCalledTimes(1);
    expect(memzero.mock.calls[0]?.[0]).toEqual(new Uint8Array(32));
  });
});

describe('key validation', () => {
  it('rejects a master key of the wrong length', async () => {
    const { recovery } = await setup();
    await expect(generateManagerKey(new Uint8Array(16), OWNER, recovery.publicKey)).rejects.toThrow(
      /master key/,
    );
  });

  it('rejects a recovery public key of the wrong length', async () => {
    const masterKey = await generateMasterKey();
    await expect(generateManagerKey(masterKey, OWNER, new Uint8Array(8))).rejects.toThrow(
      /recovery public key/,
    );
  });

  it('rejects an empty owner id or purpose', async () => {
    const { masterKey, wrappedKey, recovery } = await setup();
    await expect(generateManagerKey(masterKey, '', recovery.publicKey)).rejects.toThrow(/ownerId/);
    await expect(encrypt('x', wrappedKey, masterKey, { ...NOTE, purpose: '' })).rejects.toThrow(
      /purpose/,
    );
  });
});

describe('master key rotation', () => {
  it('re-wraps the manager key and keeps existing data readable', async () => {
    const { masterKey, wrappedKey } = await setup();
    const ciphertext = await encrypt('private note', wrappedKey, masterKey, NOTE);
    const newMaster = await generateMasterKey();

    const rewrapped = await rewrapManagerKey(wrappedKey, OWNER, masterKey, newMaster);

    expect(text(await decrypt(ciphertext, rewrapped, newMaster, NOTE))).toBe('private note');
    await expect(decrypt(ciphertext, rewrapped, masterKey, NOTE)).rejects.toThrow(CryptoError);
  });

  it('refuses to re-wrap with the wrong old master key', async () => {
    const { wrappedKey } = await setup();
    const wrongOld = await generateMasterKey();
    const newMaster = await generateMasterKey();
    await expect(rewrapManagerKey(wrappedKey, OWNER, wrongOld, newMaster)).rejects.toThrow(
      CryptoError,
    );
  });
});

describe('manager key rotation', () => {
  it('re-encrypts the given ciphertexts under a new manager key', async () => {
    const { masterKey, wrappedKey, recovery, recoveryKey } = await setup();
    const goal = { ...NOTE, purpose: 'goal' };
    const first = await encrypt('first', wrappedKey, masterKey, NOTE);
    const second = await encrypt('second', wrappedKey, masterKey, goal);

    const rotated = await rotateManagerKey(wrappedKey, masterKey, OWNER, recovery.publicKey, [
      { ciphertext: first, purpose: NOTE.purpose },
      { ciphertext: second, purpose: goal.purpose },
    ]);

    expect(rotated.wrappedKey).not.toEqual(wrappedKey);
    expect(rotated.recoveryKey).not.toEqual(recoveryKey);
    const [newFirst, newSecond] = rotated.ciphertexts;
    if (!newFirst || !newSecond) throw new Error('missing rotated ciphertexts');
    expect(text(await decrypt(newFirst, rotated.wrappedKey, masterKey, NOTE))).toBe('first');
    expect(text(await decrypt(newSecond, rotated.wrappedKey, masterKey, goal))).toBe('second');
    const recovered = await recoverManagerKey(rotated.recoveryKey, OWNER, recovery, masterKey, {
      ciphertext: newFirst,
      purpose: NOTE.purpose,
    });
    expect(text(await decrypt(newFirst, recovered, masterKey, NOTE))).toBe('first');
    await expect(decrypt(newFirst, wrappedKey, masterKey, NOTE)).rejects.toThrow(CryptoError);
    await expect(decrypt(first, rotated.wrappedKey, masterKey, NOTE)).rejects.toThrow(CryptoError);
  });

  it('fails as a whole when one ciphertext cannot be read', async () => {
    const { masterKey, wrappedKey, recovery } = await setup();
    const good = await encrypt('good', wrappedKey, masterKey, NOTE);
    await expect(
      rotateManagerKey(wrappedKey, masterKey, OWNER, recovery.publicKey, [
        { ciphertext: good, purpose: NOTE.purpose },
        { ciphertext: flipByte(good, 30), purpose: NOTE.purpose },
      ]),
    ).rejects.toThrow(CryptoError);
  });
});
