import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

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

// A record a manager keeps, independent of the login account table (core.account).
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

// A manager's login account. Not linked to core.person: whether it maps to a person is an open
// question (lot 5).
export const account = core.table(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The Google OIDC `sub` claim: the stable identity; the email may change. Unique alone
    // because Google is the only issuer; a second one would make the key (issuer, subject).
    oidcSubject: text('oidc_subject').notNull().unique(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('account_email_lower_unique').on(sql`lower(${table.email})`)],
);

// Server-side sessions, so a logout revokes. Only a SHA-256 hash of the token is stored.
export const session = core.table(
  'session',
  {
    tokenHash: text('token_hash').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check('session_expires_after_created', sql`${table.expiresAt} > ${table.createdAt}`),
    // A raw token written by mistake is refused: only a SHA-256 hex digest fits.
    check('session_token_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    index('session_account_id_index').on(table.accountId),
    index('session_expires_at_index').on(table.expiresAt),
  ],
);
