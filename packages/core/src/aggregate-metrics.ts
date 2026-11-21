/**
 * Aggregated metrics per team and metric name, sorted for deterministic
 * reports. Following the data collection charter, an aggregate never keeps
 * any individual-level breakdown and every total must be traceable to the
 * records it was built from.
 */
export interface MetricRecord {
  readonly team: string;
  readonly metric: string;
  readonly value: number;
}

export interface TeamMetricTotal {
  readonly team: string;
  readonly metric: string;
  readonly total: number;
}

export function aggregateMetricsByTeam(
  records: readonly MetricRecord[],
): readonly TeamMetricTotal[] {
  const teamNames = new Set(records.map((record) => record.team));
  for (const team of teamNames) {
    if (team === '' || team.trim() !== team) {
      throw new Error(`aggregateMetricsByTeam: every record needs a named team, got '${team}'`);
    }
  }

  const totals = new Map<string, TeamMetricTotal>();
  for (const record of records) {
    if (!Number.isFinite(record.value)) {
      throw new Error(
        `aggregateMetricsByTeam: value for team '${record.team}' and metric '${record.metric}' is not a finite number`,
      );
    }
    const key = `${record.team}\u0000${record.metric}`;
    const previous = totals.get(key);
    const previousTotal = previous ? previous.total : 0;
    totals.set(key, {
      team: record.team,
      metric: record.metric,
      total: previousTotal + record.value,
    });
  }

  return [...totals.values()].sort((first, second) =>
    first.team === second.team
      ? first.metric.localeCompare(second.metric)
      : first.team.localeCompare(second.team),
  );
}
