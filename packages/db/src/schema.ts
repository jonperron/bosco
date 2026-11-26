import { sql } from 'drizzle-orm';
import { boolean, check, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const core = pgSchema('core');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// A period [started_at, ended_at); ended_at null means still open.
const period = {
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
};

// One organisation per install: the primary key can only ever hold `true`.
export const organisation = core.table(
  'organisation',
  {
    id: boolean('id').primaryKey().default(true),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [check('organisation_single_row', sql`${table.id}`)],
);

// Independent of any login account: accounts arrive with lot 4.
export const person = core.table(
  'person',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    email: text('email').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('person_email_lower_unique').on(sql`lower(${table.email})`)],
);

export const team = core.table('team', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...timestamps,
});

// Overlap exclusion lives in a hand-written migration: drizzle-kit cannot express EXCLUDE.
export const teamMembership = core.table(
  'team_membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'restrict' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'restrict' }),
    ...period,
    ...timestamps,
  },
  (table) => [check('team_membership_period_order', sql`${table.endedAt} > ${table.startedAt}`)],
);

// Manager-cycle prevention (A manages B manages A) is an application rule, left to lot 5.
export const managerAttachment = core.table(
  'manager_attachment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'restrict' }),
    managerId: uuid('manager_id')
      .notNull()
      .references(() => person.id, { onDelete: 'restrict' }),
    ...period,
    ...timestamps,
  },
  (table) => [
    check('manager_attachment_not_self', sql`${table.personId} <> ${table.managerId}`),
    check('manager_attachment_period_order', sql`${table.endedAt} > ${table.startedAt}`),
  ],
);
