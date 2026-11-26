import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MASTER_KEY_FILE_ENV, loadMasterKeyFromFile } from '../src/index.js';

let directory: string;
const keyBytes = Uint8Array.from({ length: 32 }, (_unused, index) => index);
const keyBase64 = Buffer.from(keyBytes).toString('base64');

async function fileWith(name: string, content: string) {
  const path = join(directory, name);
  await writeFile(path, content);
  return { [MASTER_KEY_FILE_ENV]: path };
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bosco-crypto-'));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('loadMasterKeyFromFile', () => {
  it('reads a base64 key, ignoring the trailing newline', async () => {
    const env = await fileWith('key', `${keyBase64}\n`);
    expect(await loadMasterKeyFromFile(env)).toEqual(keyBytes);
  });

  it('fails when the variable is not set', async () => {
    await expect(loadMasterKeyFromFile({})).rejects.toThrow(/BOSCO_MASTER_KEY_FILE is not set/);
  });

  it('fails when the file cannot be read', async () => {
    const env = { [MASTER_KEY_FILE_ENV]: join(directory, 'missing') };
    await expect(loadMasterKeyFromFile(env)).rejects.toThrow(/cannot read the master key file/);
  });

  it('fails on content that is not base64, without echoing it', async () => {
    const env = await fileWith('garbage', 'not*base64*secret');
    const error = await loadMasterKeyFromFile(env).catch((caught: unknown) => caught);
    expect(String(error)).toMatch(/not valid base64/);
    expect(String(error)).not.toContain('secret');
  });

  it('fails on a key of the wrong size', async () => {
    const env = await fileWith('short', Buffer.alloc(16).toString('base64'));
    await expect(loadMasterKeyFromFile(env)).rejects.toThrow(/master key must be 32 bytes/);
  });
});
