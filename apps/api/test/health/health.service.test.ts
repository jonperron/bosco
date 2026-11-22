import { describe, expect, it } from 'vitest';

import { HealthService } from '@/health/health.service.js';

describe('HealthService', () => {
  it('reports the version it was given', () => {
    const health = new HealthService('9.9.9-test').getHealth();
    expect(health.version).toBe('9.9.9-test');
  });

  it('reports ok with a non-negative integer uptime', () => {
    const health = new HealthService('9.9.9-test').getHealth();
    expect(health.status).toBe('ok');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(health.uptimeSeconds)).toBe(true);
  });
});
