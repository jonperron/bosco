/**
 * DI token carrying the API version, read once in main.ts (the only place
 * allowed to depend on package.json) and injected everywhere else.
 */
export const APP_VERSION = 'APP_VERSION' as const;
