import { randomUUID } from 'node:crypto';
import { count, eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import { managerAttachment, organisation, person, team, teamMembership } from '../src/schema.js';
import { demoData, seedDemoData } from '../src/seed.js';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error('DATABASE_URL is required by the integration suite (see .env.example).');
}

// Each run gets its own throwaway database, created from empty and dropped at the end.
const databaseName = `bosco_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client({ connectionString: baseUrl });
let db: Database;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  db = createDatabase(url.toString());
});

afterAll(async () => {
  if (db) {
    // pool.end() resolves before its clients' sockets close; wait for every 'remove' so that
    // DROP ... WITH (FORCE) cannot kill a closing backend (unhandled 57P01 error).
    const pool = db.$client;
    let open = pool.totalCount;
    const closed = new Promise<void>((resolve) => {
      if (open === 0) resolve();
      pool.on('remove', () => --open === 0 && resolve());
    });
    await pool.end();
    await closed;
  }
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
});

async function appliedMigrations(): Promise<number> {
  const result = await db.execute<{ total: number }>(
    sql`select count(*)::int as total from drizzle.__drizzle_migrations`,
  );
  return result.rows[0]?.total ?? 0;
}

async function rowCounts() {
  const tables = { organisation, person, team, teamMembership, managerAttachment };
  const entries = await Promise.all(
    Object.entries(tables).map(async ([name, table]) => {
      const [row] = await db.select({ total: count() }).from(table);
      return [name, row?.total ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Asserts the write is rejected by the named constraint, not by any other error. */
async function expectViolation(write: Promise<unknown>, constraint: string): Promise<void> {
  const error = await write.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error, `expected ${constraint} to reject the write`).toBeDefined();
  // Drizzle wraps the driver error; the constraint name sits on the pg error.
  const driverError = error instanceof Error && error.cause ? error.cause : error;
  expect(driverError).toMatchObject({ constraint });
}

describe('core schema', () => {
  it('migrates an empty database, then replays as a no-op', async () => {
    await runMigrations(db);
    const applied = await appliedMigrations();
    expect(applied).toBeGreaterThan(0);

    await runMigrations(db);
    expect(await appliedMigrations()).toBe(applied);
  });

  it('seeds the demo data, and a second seed changes nothing', async () => {
    await seedDemoData(db);
    const first = await rowCounts();
    const data = demoData();
    expect(first).toEqual({
      organisation: 1,
      person: data.people.length,
      team: data.teams.length,
      teamMembership: data.memberships.length,
      managerAttachment: data.attachments.length,
    });

    await seedDemoData(db);
    expect(await rowCounts()).toEqual(first);
  });

  describe('organisation', () => {
    it('rejects a second row', async () => {
      await expectViolation(db.insert(organisation).values({ name: 'Other' }), 'organisation_pkey');
    });

    it('rejects a row keyed anything but true', async () => {
      await expectViolation(
        db.insert(organisation).values({ id: false, name: 'Other' }),
        'organisation_single_row',
      );
    });
  });

  describe('person', () => {
    it('rejects an email that differs from an existing one only by case', async () => {
      const [existing] = demoData().people;
      await expectViolation(
        db
          .insert(person)
          .values({ displayName: 'Copy', email: existing?.email.toUpperCase() ?? '' }),
        'person_email_lower_unique',
      );
    });

    it('cannot be deleted while history references them', async () => {
      const [manager] = demoData().people;
      await expectViolation(
        db.delete(person).where(eq(person.id, manager?.id ?? '')),
        'manager_attachment_manager_id_person_id_fk',
      );
    });
  });

  describe('manager attachment', () => {
    const [first, second, third] = demoData().people.map((member) => member.id);
    const personId = first ?? '';
    const managerId = second ?? '';
    const otherManagerId = third ?? '';

    it('rejects a person as their own manager', async () => {
      await expectViolation(
        db.insert(managerAttachment).values({ personId, managerId: personId }),
        'manager_attachment_not_self',
      );
    });

    it('rejects a period that ends before it starts', async () => {
      await expectViolation(
        db.insert(managerAttachment).values({
          personId,
          managerId,
          startedAt: new Date('2020-02-01T00:00:00Z'),
          endedAt: new Date('2020-01-01T00:00:00Z'),
        }),
        'manager_attachment_period_order',
      );
    });

    it('accepts back-to-back periods and rejects an overlapping one', async () => {
      await db.insert(managerAttachment).values([
        {
          personId,
          managerId,
          startedAt: new Date('2020-01-01T00:00:00Z'),
          endedAt: new Date('2021-01-01T00:00:00Z'),
        },
        {
          personId,
          managerId: otherManagerId,
          startedAt: new Date('2021-01-01T00:00:00Z'),
          endedAt: new Date('2022-01-01T00:00:00Z'),
        },
      ]);
      await expectViolation(
        db.insert(managerAttachment).values({
          personId,
          managerId,
          startedAt: new Date('2021-06-01T00:00:00Z'),
        }),
        'manager_attachment_no_overlap',
      );
    });
  });

  describe('team membership', () => {
    const [platform] = demoData().teams;
    const teamId = platform?.id ?? '';
    const personId = demoData().people[0]?.id ?? '';

    it('rejects a period that ends before it starts', async () => {
      await expectViolation(
        db.insert(teamMembership).values({
          teamId,
          personId,
          startedAt: new Date('2020-02-01T00:00:00Z'),
          endedAt: new Date('2020-01-01T00:00:00Z'),
        }),
        'team_membership_period_order',
      );
    });

    it('rejects two overlapping periods in the same team', async () => {
      await db.insert(teamMembership).values({
        teamId,
        personId,
        startedAt: new Date('2020-01-01T00:00:00Z'),
        endedAt: new Date('2021-01-01T00:00:00Z'),
      });
      await expectViolation(
        db.insert(teamMembership).values({
          teamId,
          personId,
          startedAt: new Date('2020-06-01T00:00:00Z'),
        }),
        'team_membership_no_overlap',
      );
    });
  });

  it('refuses to seed into a database that holds a real organisation, teams or people', async () => {
    await db.update(organisation).set({ name: 'Real organisation' });
    await expect(seedDemoData(db)).rejects.toThrow(/non-demo/);
    await db.update(organisation).set({ name: demoData().organisation.name });

    await db.insert(team).values({ name: 'Real team' });
    await expect(seedDemoData(db)).rejects.toThrow(/non-demo/);
    await db.delete(team).where(eq(team.name, 'Real team'));

    await db.insert(person).values({ displayName: 'Someone', email: 'someone@example.org' });
    const before = await rowCounts();
    await expect(seedDemoData(db)).rejects.toThrow(/non-demo/);
    expect(await rowCounts()).toEqual(before);
  });
});
