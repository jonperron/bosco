import { createApiClient } from '@bosco/api-client';

/** Base URL of the API; empty when the API serves the app itself (same origin). */
export const API_BASE_URL: string = import.meta.env['VITE_API_BASE_URL'] ?? '';

/**
 * The single API client of the app. Every HTTP call must go through it:
 * a hand-written fetch would bypass the committed OpenAPI contract.
 */
export const apiClient = createApiClient(API_BASE_URL);
