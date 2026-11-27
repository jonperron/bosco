import { randomUUID } from 'node:crypto';
import { asc, count, eq, isNull, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import { importPeopleCsv, PeopleCsvError } from '../src/people-import.js';
import { managerAttachment, person } from '../src/schema.js';

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
  await runMigrations(db);
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

// Fictitious records on the reserved example.com domain (RFC 2606).
const HEADER = 'display_name,email,manager_email';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\r\n');

async function idOf(email: string): Promise<string> {
  const [row] = await db.select({ id: person.id }).from(person).where(eq(person.email, email));
  if (!row) throw new Error(`no person ${email}`);
  return row.id;
}

async function attachmentsOf(email: string) {
  return db
    .select({
      managerId: managerAttachment.managerId,
      startedAt: managerAttachment.startedAt,
      endedAt: managerAttachment.endedAt,
    })
    .from(managerAttachment)
    .where(eq(managerAttachment.personId, await idOf(email)))
    .orderBy(asc(managerAttachment.startedAt));
}

async function totals() {
  const [people] = await db.select({ total: count() }).from(person);
  const [attachments] = await db.select({ total: count() }).from(managerAttachment);
  return { people: people?.total, attachments: attachments?.total };
}

describe('importPeopleCsv', () => {
  it('creates people and attaches each to a manager listed later in the file', async () => {
    const result = await importPeopleCsv(
      db,
      csv(
        'Bo Beta,bo@example.com,ada@example.com',
        'Ada Alpha,ada@example.com,',
        'Cy Gamma,cy@example.com,ADA@EXAMPLE.COM',
      ),
    );
    expect(result).toEqual({ created: 3, updated: 0, managersChanged: 2 });
    const adaId = await idOf('ada@example.com');
    expect(await attachmentsOf('bo@example.com')).toEqual([
      expect.objectContaining({ managerId: adaId, endedAt: null }),
    ]);
    expect(await attachmentsOf('ada@example.com')).toEqual([]);
  });

  it('upserts on email: a re-import duplicates no one and keeps open attachments', async () => {
    const before = await totals();
    const result = await importPeopleCsv(
      db,
      csv('Bo Beta,BO@example.com,ada@example.com', 'Ada A. Alpha,ada@example.com,'),
    );
    expect(result).toEqual({ created: 0, updated: 1, managersChanged: 0 });
    expect(await totals()).toEqual(before);
    const [ada] = await db.select().from(person).where(eq(person.email, 'ada@example.com'));
    expect(ada?.displayName).toBe('Ada A. Alpha');
  });

  it('changes a manager by ending the open attachment and opening a new one', async () => {
    const result = await importPeopleCsv(db, csv('Bo Beta,bo@example.com,cy@example.com'));
    expect(result).toEqual({ created: 0, updated: 0, managersChanged: 1 });
    const [previous, current] = await attachmentsOf('bo@example.com');
    expect(previous?.managerId).toBe(await idOf('ada@example.com'));
    expect(current?.managerId).toBe(await idOf('cy@example.com'));
    // Back to back: the old period ends exactly when the new one starts.
    expect(previous?.endedAt).toEqual(current?.startedAt);
    expect(current?.endedAt).toBeNull();
    const open = await db
      .select({ total: count() })
      .from(managerAttachment)
      .where(isNull(managerAttachment.endedAt));
    expect(open[0]?.total).toBe(2);
  });

  it('attaches to a manager already in the database but absent from the file', async () => {
    await importPeopleCsv(db, csv('Di Delta,di@example.com,Ada@Example.com'));
    expect(await attachmentsOf('di@example.com')).toEqual([
      expect.objectContaining({ managerId: await idOf('ada@example.com'), endedAt: null }),
    ]);
  });

  it('rejects an unknown manager, writing nothing', async () => {
    const before = await totals();
    const error = await importPeopleCsv(
      db,
      csv('Ed Epsilon,ed@example.com,', 'Fy Phi,fy@example.com,nobody@example.com'),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PeopleCsvError);
    expect((error as PeopleCsvError).problems).toEqual([
      { line: 3, message: 'manager_email matches no one in the file or the database' },
    ]);
    expect(await totals()).toEqual(before);
  });

  it('rejects an invalid file before touching the database', async () => {
    const before = await totals();
    await expect(
      importPeopleCsv(db, csv('Ed Epsilon,ed@example.com,', 'Ed Again,ED@example.com,')),
    ).rejects.toThrow(/line 3: email duplicates line 2/);
    expect(await totals()).toEqual(before);
  });

  it('runs concurrent imports one after the other, so all succeed', async () => {
    // Open the connections first, so the imports overlap instead of waiting on connects.
    await Promise.all(Array.from({ length: 6 }, () => db.execute(sql`select pg_sleep(0.05)`)));
    const results = await Promise.all(
      ['Ivy Kappa', 'Ivy K.', 'Ivy', 'I. Kappa', 'Ivy Kap', 'IK'].map((name) =>
        importPeopleCsv(db, csv(`${name},ivy@example.com,`)),
      ),
    );
    expect(results.map((result) => result.created).sort()).toEqual([0, 0, 0, 0, 0, 1]);
    const [ivy] = await db
      .select({ total: count() })
      .from(person)
      .where(eq(person.email, 'ivy@example.com'));
    expect(ivy?.total).toBe(1);
  });

  it('dates a manager change from when the import got the lock, not when it began', async () => {
    // An import that began earlier but waited on the lock must not end a newer attachment
    // before it started (manager_attachment_period_order).
    const holder = new pg.Client({ connectionString: db.$client.options.connectionString });
    await holder.connect();
    await holder.query('BEGIN');
    await holder.query("select pg_advisory_xact_lock(hashtext('bosco.people_import'))");
    const waiting = importPeopleCsv(db, csv('Bo Beta,bo@example.com,ada@example.com'));
    // Release only once the import is queued on the lock, then a little later.
    const waiters =
      "select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted";
    while ((await holder.query<{ n: number }>(waiters)).rows[0]?.n !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const released = new Date();
    await holder.query('COMMIT');
    await holder.end();
    expect(await waiting).toEqual({ created: 0, updated: 0, managersChanged: 1 });
    const [, previous, current] = await attachmentsOf('bo@example.com');
    expect(current?.startedAt.getTime()).toBeGreaterThanOrEqual(released.getTime() - 50);
    expect(previous?.endedAt).toEqual(current?.startedAt);
  });

  it('rolls the whole file back when the database refuses one change', async () => {
    // An open attachment that starts in the future cannot be ended now.
    const [gil] = await db
      .insert(person)
      .values({ displayName: 'Gil Iota', email: 'gil@example.com' })
      .returning({ id: person.id });
    await db.insert(managerAttachment).values({
      personId: gil?.id ?? '',
      managerId: await idOf('ada@example.com'),
      startedAt: new Date('2999-01-01T00:00:00Z'),
    });
    const before = await totals();
    await expect(
      importPeopleCsv(
        db,
        csv('Ed Epsilon,ed@example.com,', 'Gil Iota,gil@example.com,bo@example.com'),
      ),
    ).rejects.toThrow();
    expect(await totals()).toEqual(before);
  });
});
