import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { CsvSyntaxError, parseCsv } from './csv.js';
import { managerAttachment, person } from './schema.js';

const REQUIRED_COLUMNS = ['display_name', 'email'] as const;
const COLUMNS: readonly string[] = [...REQUIRED_COLUMNS, 'manager_email'];
// Shape check only: one @, no spaces, a dot in the domain. Deliverability is not checked.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROBLEMS_IN_MESSAGE = 20;

export interface PeopleCsvRow {
  readonly line: number;
  readonly displayName: string;
  readonly email: string;
  readonly managerEmail: string | null;
}

export interface PeopleCsvProblem {
  readonly line: number;
  readonly message: string;
}

export interface PeopleImportResult {
  readonly created: number;
  readonly updated: number;
  readonly managersChanged: number;
}

/** The file was rejected as a whole. Messages name lines and columns, never a value. */
export class PeopleCsvError extends Error {
  constructor(readonly problems: readonly PeopleCsvProblem[]) {
    const lines = problems
      .slice(0, MAX_PROBLEMS_IN_MESSAGE)
      .map((problem) => `line ${problem.line}: ${problem.message}`);
    if (problems.length > MAX_PROBLEMS_IN_MESSAGE) {
      lines.push(`...and ${problems.length - MAX_PROBLEMS_IN_MESSAGE} more`);
    }
    super(`Invalid people CSV, nothing imported:\n${lines.join('\n')}`);
    this.name = 'PeopleCsvError';
  }
}

function readHeader(names: readonly string[], line: number): void {
  const problems = [
    ...REQUIRED_COLUMNS.filter((name) => !names.includes(name)).map(
      (name) => `missing column ${name}`,
    ),
    // By position: an unknown header cell may be a data row (a file without a header).
    ...names.flatMap((name, index) =>
      COLUMNS.includes(name) ? [] : [`unknown column ${index + 1}`],
    ),
    ...names
      .filter((name, index) => COLUMNS.includes(name) && names.indexOf(name) !== index)
      .map((name) => `repeated column ${name}`),
  ];
  if (problems.length > 0) {
    throw new PeopleCsvError(problems.map((message) => ({ line, message })));
  }
}

/**
 * Validates a people CSV without touching the database: a header row with `display_name` and
 * `email`, optionally `manager_email`. Throws a PeopleCsvError listing every invalid line.
 */
export function parsePeopleCsv(csvText: string): PeopleCsvRow[] {
  let records;
  try {
    records = parseCsv(csvText);
  } catch (error) {
    if (error instanceof CsvSyntaxError) {
      throw new PeopleCsvError([{ line: error.line, message: error.reason }]);
    }
    throw error;
  }
  const blank = (fields: readonly string[]) => fields.length === 1 && fields[0]?.trim() === '';
  const [header, ...body] = records.filter((record) => !blank(record.fields));
  if (!header) {
    throw new PeopleCsvError([{ line: 1, message: 'the file is empty; expected a header row' }]);
  }
  const names = header.fields.map((name) => name.trim().toLowerCase());
  readHeader(names, header.line);

  const problems: PeopleCsvProblem[] = [];
  const rows: PeopleCsvRow[] = [];
  const firstLineByEmail = new Map<string, number>();
  for (const { line, fields } of body) {
    if (fields.length !== names.length) {
      problems.push({ line, message: `expected ${names.length} fields, found ${fields.length}` });
      continue;
    }
    const value = (name: string) => fields[names.indexOf(name)]?.trim() ?? '';
    const displayName = value('display_name');
    const email = value('email');
    const managerEmail = value('manager_email');
    const problem = (message: string) => problems.push({ line, message });

    if (displayName === '') problem('display_name is empty');
    if (email === '') problem('email is empty');
    else if (!EMAIL.test(email)) problem('email is malformed');
    if (managerEmail !== '' && !EMAIL.test(managerEmail)) problem('manager_email is malformed');
    if (email !== '' && email.toLowerCase() === managerEmail.toLowerCase()) {
      problem('a person cannot be their own manager');
    }
    const firstLine = firstLineByEmail.get(email.toLowerCase());
    if (email !== '' && firstLine !== undefined) problem(`email duplicates line ${firstLine}`);
    else firstLineByEmail.set(email.toLowerCase(), line);

    rows.push({
      line,
      displayName,
      email,
      managerEmail: managerEmail === '' ? null : managerEmail,
    });
  }
  if (problems.length > 0) throw new PeopleCsvError(problems);
  return rows;
}

/**
 * Imports people from CSV in one transaction: everything is written or nothing is. Upserts on
 * email (case-insensitive), updating the display name. A non-empty `manager_email` must name
 * someone in the file or the database; a change of manager ends the open attachment and opens a
 * new one, both at the transaction's time. An empty `manager_email` leaves attachments as they
 * are.
 */
export async function importPeopleCsv(db: Database, csvText: string): Promise<PeopleImportResult> {
  const rows = parsePeopleCsv(csvText);
  const key = (email: string) => email.toLowerCase();
  // shortcut: keys are lowered in JS but matched with Postgres lower(); outside ASCII they may
  // differ, and the unique index then rejects the import. Lower in SQL if that ever matters.
  // shortcut: one statement per step, so Postgres' 65535-parameter cap limits a file to about
  // 30,000 rows; batch the statements if files ever get that large.
  const managerKeys = rows.flatMap((row) =>
    row.managerEmail === null ? [] : [key(row.managerEmail)],
  );
  const emails = [...new Set([...rows.map((row) => key(row.email)), ...managerKeys])];
  if (emails.length === 0) return { created: 0, updated: 0, managersChanged: 0 };

  return db.transaction(async (tx) => {
    // Imports queue behind each other, so each one reads what the previous one committed.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bosco.people_import'))`);
    const lowerEmail = sql<string>`lower(${person.email})`;
    const existing = await tx
      .select({ id: person.id, email: lowerEmail, displayName: person.displayName })
      .from(person)
      .where(inArray(lowerEmail, emails));
    const idByEmail = new Map(existing.map((row) => [row.email, row.id]));
    const fileEmails = new Set(rows.map((row) => key(row.email)));

    const unknown = rows.filter((row) => {
      const manager = row.managerEmail === null ? null : key(row.managerEmail);
      return manager !== null && !fileEmails.has(manager) && !idByEmail.has(manager);
    });
    if (unknown.length > 0) {
      throw new PeopleCsvError(
        unknown.map(({ line }) => ({
          line,
          message: 'manager_email matches no one in the file or the database',
        })),
      );
    }

    const newRows = rows.filter((row) => !idByEmail.has(key(row.email)));
    if (newRows.length > 0) {
      const inserted = await tx
        .insert(person)
        .values(newRows.map(({ displayName, email }) => ({ displayName, email })))
        .returning({ id: person.id, email: lowerEmail });
      for (const row of inserted) idByEmail.set(row.email, row.id);
    }

    const storedName = new Map(existing.map((row) => [row.id, row.displayName]));
    const renamed = rows.filter((row) => {
      const name = storedName.get(idByEmail.get(key(row.email)) ?? '');
      return name !== undefined && name !== row.displayName;
    });
    for (const row of renamed) {
      await tx
        .update(person)
        .set({ displayName: row.displayName })
        .where(eq(lowerEmail, key(row.email)));
    }

    const wanted = rows.flatMap((row) =>
      row.managerEmail === null
        ? []
        : [
            {
              personId: idByEmail.get(key(row.email)) ?? '',
              managerId: idByEmail.get(key(row.managerEmail)) ?? '',
            },
          ],
    );
    const open =
      wanted.length === 0
        ? []
        : await tx
            .select({
              personId: managerAttachment.personId,
              managerId: managerAttachment.managerId,
            })
            .from(managerAttachment)
            .where(
              and(
                inArray(
                  managerAttachment.personId,
                  wanted.map((attachment) => attachment.personId),
                ),
                isNull(managerAttachment.endedAt),
              ),
            );
    const currentManager = new Map(open.map((row) => [row.personId, row.managerId]));
    const changes = wanted.filter(
      (attachment) => currentManager.get(attachment.personId) !== attachment.managerId,
    );
    if (changes.length > 0) {
      // now() is the transaction's start time: the old period ends exactly where the new begins.
      await tx
        .update(managerAttachment)
        .set({ endedAt: sql`now()` })
        .where(
          and(
            inArray(
              managerAttachment.personId,
              changes.map((attachment) => attachment.personId),
            ),
            isNull(managerAttachment.endedAt),
          ),
        );
      await tx.insert(managerAttachment).values(changes);
    }

    return { created: newRows.length, updated: renamed.length, managersChanged: changes.length };
  });
}
