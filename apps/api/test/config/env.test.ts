import { describe, expect, it } from 'vitest';

import { EnvValidationError, validateEnv } from '@/config/env.js';

describe('validateEnv', () => {
  it('defaults PORT to 3000 when absent', () => {
    expect(validateEnv({})).toEqual({ PORT: 3000, WEB_DIST: null });
  });

  it('normalises a valid environment', () => {
    expect(validateEnv({ PORT: '4000', WEB_DIST: '/srv/bosco/web' })).toEqual({
      PORT: 4000,
      WEB_DIST: '/srv/bosco/web',
    });
  });

  it('rejects a malformed PORT naming the variable', () => {
    expect(() => validateEnv({ PORT: 'not-a-port' })).toThrowError(EnvValidationError);
    try {
      validateEnv({ PORT: 'not-a-port' });
    } catch (error) {
      expect((error as EnvValidationError).issues).toContainEqual(expect.stringContaining('PORT'));
    }
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrowError(EnvValidationError);
  });

  it('ignores a blank WEB_DIST', () => {
    expect(validateEnv({ WEB_DIST: '   ' }).WEB_DIST).toBeNull();
  });
});
