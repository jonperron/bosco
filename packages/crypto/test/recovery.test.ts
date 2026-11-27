import { describe, expect, it } from 'vitest';
import {
  CryptoError,
  decrypt,
  encrypt,
  generateManagerKey,
  generateMasterKey,
  generateRecoveryKeyPair,
  recoverManagerKey,
  type StoredCiphertext,
} from '../src/index.js';

const OWNER = 'manager-a';
const NOTE = { ownerId: OWNER, purpose: 'one-on-one-note' };

async function setup() {
  const masterKey = await generateMasterKey();
  const recovery = await generateRecoveryKeyPair();
  const managerKey = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
  const ciphertext = await encrypt('private note', managerKey.wrappedKey, masterKey, NOTE);
  const verify = { ciphertext, purpose: NOTE.purpose };
  return { masterKey, recovery, ...managerKey, ciphertext, verify };
}

describe('admin recovery', () => {
  it('recovers a manager key with the admin private key, under a new master key', async () => {
    const { recovery, recoveryKey, ciphertext, verify } = await setup();
    const newMaster = await generateMasterKey();

    const wrappedKey = await recoverManagerKey(recoveryKey, OWNER, recovery, newMaster, verify);

    const plaintext = await decrypt(ciphertext, wrappedKey, newMaster, NOTE);
    expect(new TextDecoder().decode(plaintext)).toBe('private note');
  });

  it('refuses a planted recovery key that does not open existing data', async () => {
    const { masterKey, recovery, verify } = await setup();
    // Anyone with the public key can seal a data key of their own for the same owner.
    const planted = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
    await expect(
      recoverManagerKey(planted.recoveryKey, OWNER, recovery, masterKey, verify),
    ).rejects.toThrow(CryptoError);
  });

  it('refuses to recover without an existing ciphertext to verify against', async () => {
    const { masterKey, recovery } = await setup();
    const planted = await generateManagerKey(masterKey, OWNER, recovery.publicKey);
    const missing = undefined as unknown as StoredCiphertext;
    await expect(
      recoverManagerKey(planted.recoveryKey, OWNER, recovery, masterKey, missing),
    ).rejects.toThrow(/verify/);
  });

  it('fails with the wrong admin key pair', async () => {
    const { masterKey, recoveryKey, verify } = await setup();
    const wrongPair = await generateRecoveryKeyPair();
    await expect(
      recoverManagerKey(recoveryKey, OWNER, wrongPair, masterKey, verify),
    ).rejects.toThrow(CryptoError);
  });

  it('fails when the recovery key belongs to another owner', async () => {
    const { masterKey, recovery, recoveryKey, verify } = await setup();
    await expect(
      recoverManagerKey(recoveryKey, 'manager-b', recovery, masterKey, verify),
    ).rejects.toThrow(/another owner/);
  });

  it('fails on a tampered or truncated recovery key', async () => {
    const { masterKey, recovery, recoveryKey, verify } = await setup();
    const tampered = Uint8Array.from(recoveryKey);
    tampered[10] = (tampered[10] ?? 0) ^ 0x01;
    await expect(recoverManagerKey(tampered, OWNER, recovery, masterKey, verify)).rejects.toThrow(
      CryptoError,
    );
    await expect(
      recoverManagerKey(recoveryKey.subarray(0, 20), OWNER, recovery, masterKey, verify),
    ).rejects.toThrow(/malformed/);
  });

  it('does not contain the manager key in clear', async () => {
    const { recoveryKey, wrappedKey } = await setup();
    expect(recoveryKey).not.toEqual(wrappedKey);
    expect(recoveryKey[0]).toBe(1);
  });
});
