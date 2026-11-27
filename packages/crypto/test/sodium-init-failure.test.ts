import { describe, expect, it, vi } from 'vitest';

vi.mock('libsodium-wrappers', async (importOriginal) => {
  const actual = await importOriginal<{ default: object }>();
  const ready = Promise.reject(new Error('wasm failed'));
  ready.catch(() => undefined);
  return { default: { ...actual.default, ready } };
});

const { CryptoError, MASTER_KEY_FILE_ENV, generateMasterKey, loadMasterKeyFromFile } =
  await import('../src/index.js');

describe('libsodium initialisation failure', () => {
  it('surfaces as a CryptoError from the public API', async () => {
    await expect(generateMasterKey()).rejects.toThrow(CryptoError);
    await expect(generateMasterKey()).rejects.toThrow(/libsodium failed to initialise/);
  });

  it('fails before the master key file is read', async () => {
    const env = { [MASTER_KEY_FILE_ENV]: '/nonexistent/bosco-master-key' };
    await expect(loadMasterKeyFromFile(env)).rejects.toThrow(/libsodium failed to initialise/);
  });
});
