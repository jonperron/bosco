import { describe, expect, it } from 'vitest';

import { aggregateMetricsByTeam, MetricRecord } from '../src/aggregate-metrics.js';

describe('aggregateMetricsByTeam', () => {
  it('totals metrics per team without keeping any individual breakdown', () => {
    const records: readonly MetricRecord[] = [
      { team: 'alpha', metric: 'commits', value: 3 },
      { team: 'beta', metric: 'commits', value: 5 },
      { team: 'alpha', metric: 'commits', value: 4 },
      { team: 'alpha', metric: 'reviews', value: 2 },
    ];

    const result = aggregateMetricsByTeam(records);

    expect(result).toEqual([
      { team: 'alpha', metric: 'commits', total: 7 },
      { team: 'alpha', metric: 'reviews', total: 2 },
      { team: 'beta', metric: 'commits', total: 5 },
    ]);
  });

  it('rejects a non finite value so no fabricated number enters a report', () => {
    const records: readonly MetricRecord[] = [
      { team: 'alpha', metric: 'commits', value: Number.NaN },
    ];

    expect(() => aggregateMetricsByTeam(records)).toThrow(/finite/i);
  });

  it('rejects an empty team so aggregation can never attach a metric to a blank owner', () => {
    const records: readonly MetricRecord[] = [{ team: '', metric: 'commits', value: 1 }];

    expect(() => aggregateMetricsByTeam(records)).toThrow(/team/i);
  });
});
