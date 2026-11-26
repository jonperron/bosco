import { notInArray } from 'drizzle-orm';
import type { Database } from './client.js';
import { managerAttachment, organisation, person, team, teamMembership } from './schema.js';

// Fictitious on purpose: no real person, no real domain (example.com is reserved, RFC 2606).
const NAMES = [
  ['Alex', 'Alpha'],
  ['Camille', 'Delta'],
  ['Sacha', 'Sigma'],
  ['Morgan', 'Omega'],
  ['Charlie', 'Alpha'],
  ['Noa', 'Delta'],
  ['Eden', 'Sigma'],
  ['Lou', 'Omega'],
  ['Robin', 'Alpha'],
  ['Andrea', 'Delta'],
  ['Jules', 'Sigma'],
  ['Dominique', 'Omega'],
] as const;

const PREVIOUS_PERIOD_START = new Date('2024-01-01T00:00:00Z');
const CURRENT_PERIOD_START = new Date('2025-01-01T00:00:00Z');

// Fixed ids make the seed idempotent: a rerun conflicts on every primary key and inserts nothing.
const KIND = { person: 1, team: 2, membership: 3, attachment: 4 } as const;
function demoId(kind: keyof typeof KIND, index: number): string {
  const suffix = `${String(KIND[kind]).padStart(4, '0')}${String(index).padStart(8, '0')}`;
  return `00000000-0000-4000-8000-${suffix}`;
}

/** The demo organisation: 12 people, 2 teams, one manager change and one team change. */
export function demoData() {
  const people = NAMES.map(([firstName, lastName], index) => ({
    id: demoId('person', index + 1),
    displayName: `${firstName} ${lastName}`,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
  }));
  const personId = (index: number) => demoId('person', index);
  const teams = [
    { id: demoId('team', 1), name: 'Platform' },
    { id: demoId('team', 2), name: 'Product' },
  ];

  // [person, team or manager, start, end]
  type Period = readonly [number, number, Date, Date | null];
  const memberships: Period[] = [
    [2, 1, CURRENT_PERIOD_START, null],
    [4, 1, CURRENT_PERIOD_START, null],
    [5, 1, CURRENT_PERIOD_START, null],
    [6, 1, CURRENT_PERIOD_START, null],
    [7, 1, CURRENT_PERIOD_START, null],
    [3, 2, CURRENT_PERIOD_START, null],
    [8, 1, PREVIOUS_PERIOD_START, CURRENT_PERIOD_START],
    [8, 2, CURRENT_PERIOD_START, null],
    [9, 2, CURRENT_PERIOD_START, null],
    [10, 2, CURRENT_PERIOD_START, null],
    [11, 2, CURRENT_PERIOD_START, null],
    [12, 2, CURRENT_PERIOD_START, null],
  ];
  const attachments: Period[] = [
    [2, 1, CURRENT_PERIOD_START, null],
    [3, 1, CURRENT_PERIOD_START, null],
    [4, 3, PREVIOUS_PERIOD_START, CURRENT_PERIOD_START],
    [4, 2, CURRENT_PERIOD_START, null],
    [5, 2, CURRENT_PERIOD_START, null],
    [6, 2, CURRENT_PERIOD_START, null],
    [7, 2, CURRENT_PERIOD_START, null],
    [8, 3, CURRENT_PERIOD_START, null],
    [9, 3, CURRENT_PERIOD_START, null],
    [10, 3, CURRENT_PERIOD_START, null],
    [11, 3, CURRENT_PERIOD_START, null],
    [12, 3, CURRENT_PERIOD_START, null],
  ];

  return {
    organisation: { name: 'Demo organisation' },
    people,
    teams,
    memberships: memberships.map(([member, teamIndex, startedAt, endedAt], index) => ({
      id: demoId('membership', index + 1),
      personId: personId(member),
      teamId: demoId('team', teamIndex),
      startedAt,
      endedAt,
    })),
    attachments: attachments.map(([member, manager, startedAt, endedAt], index) => ({
      id: demoId('attachment', index + 1),
      personId: personId(member),
      managerId: personId(manager),
      startedAt,
      endedAt,
    })),
  };
}

/**
 * Inserts the demo data; rows that already exist are left untouched, so reruns are no-ops.
 * Refuses to run when the database already holds people other than the demo ones.
 */
export async function seedDemoData(db: Database): Promise<void> {
  const data = demoData();
  const demoPersonIds = data.people.map((member) => member.id);
  const demoTeamIds = data.teams.map((demoTeam) => demoTeam.id);
  await db.transaction(async (tx) => {
    const otherPeople = await tx.$count(person, notInArray(person.id, demoPersonIds));
    const otherTeams = await tx.$count(team, notInArray(team.id, demoTeamIds));
    if (otherPeople + otherTeams > 0) {
      throw new Error('Refusing to seed: the database holds non-demo people or teams.');
    }
    // Conflicts only on the fixed ids are expected; any other conflict must fail loudly.
    await tx
      .insert(organisation)
      .values(data.organisation)
      .onConflictDoNothing({ target: organisation.id });
    await tx.insert(person).values(data.people).onConflictDoNothing({ target: person.id });
    await tx.insert(team).values(data.teams).onConflictDoNothing({ target: team.id });
    await tx
      .insert(teamMembership)
      .values(data.memberships)
      .onConflictDoNothing({ target: teamMembership.id });
    await tx
      .insert(managerAttachment)
      .values(data.attachments)
      .onConflictDoNothing({ target: managerAttachment.id });
  });
}
