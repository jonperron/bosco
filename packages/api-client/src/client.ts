import createClient from 'openapi-fetch';

import type { paths } from './gen/schema.js';

/** A client typed against the committed OpenAPI contract of the API. */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;

export type { paths as ApiPaths };
export default createApiClient;
