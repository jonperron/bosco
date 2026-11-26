import { describe, expect, it } from 'vitest';
import {
  CryptoError,
  decrypt,
  encrypt,
  generateManagerKey,
  generateMasterKey,
  generateRecoveryKeyPair,
  recoverManagerKey,
} from '../src/index.js';

const OWNER = 'manager-a';
const NOTE = { ownerId: OWNER, purpose: 'one-on-one-note' };

async function setup() {
  const masterKey = await generateMasterKey();
  const recovery = await generateRecoveryKeyPair();
  const managerKey = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
  const ciphertext = await encrypt('private note', managerKey.wrappedKey, masterKey, NOTE);
  return { masterKey, recovery, ...managerKey, ciphertext };
}

describe('admin recovery', () => {
  it('recovers a manager key with the admin private key, under a new master key', async () => {
    const { recovery, recoveryKey, ciphertext } = await setup();
    const newMaster = await generateMasterKey();

    const wrappedKey = await recoverManagerKey(recoveryKey, OWNER, recovery, newMaster);

    const plaintext = await decrypt(ciphertext, wrappedKey, newMaster, NOTE);
    expect(new TextDecoder().decode(plaintext)).toBe('private note');
  });

  it('accepts a recovery key that opens an existing ciphertext of the owner', async () => {
    const { masterKey, recovery, recoveryKey, ciphertext } = await setup();
    const verify = { ciphertext, purpose: NOTE.purpose };
    const wrappedKey = await recoverManagerKey(recoveryKey, OWNER, recovery, masterKey, verify);
    expect(await decrypt(ciphertext, wrappedKey, masterKey, NOTE)).toBeInstanceOf(Uint8Array);
  });

  it('refuses a planted recovery key that does not open existing data', async () => {
    const { masterKey, recovery, ciphertext } = await setup();
    // Anyone with the public key can seal a data key of their own for the same owner.
    const planted = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
    const verify = { ciphertext, purpose: NOTE.purpose };
    await expect(
      recoverManagerKey(planted.recoveryKey, OWNER, recovery, masterKey, verify),
    ).rejects.toThrow(CryptoError);
  });

  it('fails with the wrong admin key pair', async () => {
    const { masterKey, recoveryKey } = await setup();
    const wrongPair = await generateRecoveryKeyPair();
    await expect(recoverManagerKey(recoveryKey, OWNER, wrongPair, masterKey)).rejects.toThrow(
      CryptoError,
    );
  });

  it('fails when the recovery key belongs to another owner', async () => {
    const { masterKey, recovery, recoveryKey } = await setup();
    await expect(recoverManagerKey(recoveryKey, 'manager-b', recovery, masterKey)).rejects.toThrow(
      /another owner/,
    );
  });

  it('fails on a tampered or truncated recovery key', async () => {
    const { masterKey, recovery, recoveryKey } = await setup();
    const tampered = Uint8Array.from(recoveryKey);
    tampered[10] = (tampered[10] ?? 0) ^ 0x01;
    await expect(recoverManagerKey(tampered, OWNER, recovery, masterKey)).rejects.toThrow(
      CryptoError,
    );
    await expect(
      recoverManagerKey(recoveryKey.subarray(0, 20), OWNER, recovery, masterKey),
    ).rejects.toThrow(/malformed/);
  });

  it('does not contain the manager key in clear', async () => {
    const { recoveryKey, wrappedKey } = await setup();
    expect(recoveryKey).not.toEqual(wrappedKey);
    expect(recoveryKey[0]).toBe(1);
  });
});
