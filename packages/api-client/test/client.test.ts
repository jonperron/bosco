import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';

import { createApiClient } from '../src/client.js';

const runningServers: Server[] = [];

afterEach(async () => {
  const servers = [...runningServers];
  runningServers.length = 0;
  for (const server of servers) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
});

/** Starts a one-shot JSON server and returns its base url. */
async function listenWith(payload: unknown): Promise<string> {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(payload));
  });
  runningServers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('the test server is not listening on a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('@bosco/api-client', () => {
  it('creates a typed client bound to a base url', () => {
    const client = createApiClient('http://localhost:9');
    expect(client).toBeDefined();
    expect(typeof client.GET).toBe('function');
  });

  it('calls the typed health path and parses the payload', async () => {
    const baseUrl = await listenWith({
      status: 'ok',
      version: '0.0.1',
      uptimeSeconds: 12,
    });

    const client = createApiClient(baseUrl);
    const { data, error } = await client.GET('/api/health');

    expect(error).toBeUndefined();
    expect(data?.status).toBe('ok');
    expect(data?.version).toBe('0.0.1');
    expectTypeOf(data).toMatchTypeOf<
      { status: 'ok'; version: string; uptimeSeconds: number } | undefined
    >();
  });
});
