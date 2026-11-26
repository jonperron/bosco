import { describe, expect, it } from 'vitest';
import { demoData } from '../src/seed.js';

describe('demoData', () => {
  const data = demoData();
  const personIds = new Set(data.people.map((member) => member.id));

  it('uses only fictitious addresses on the reserved example.com domain', () => {
    for (const member of data.people) {
      expect(member.email).toMatch(/^[a-z]+\.[a-z]+@example\.com$/);
    }
    const emails = data.people.map((member) => member.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('gives every row a distinct fixed id, so reseeding is a no-op', () => {
    const ids = [...data.people, ...data.teams, ...data.memberships, ...data.attachments].map(
      (row) => row.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(demoData()).toEqual(data);
  });

  it('only references seeded people, and nobody manages themselves', () => {
    for (const attachment of data.attachments) {
      expect(personIds.has(attachment.personId)).toBe(true);
      expect(personIds.has(attachment.managerId)).toBe(true);
      expect(attachment.personId).not.toBe(attachment.managerId);
    }
  });

  it('keeps a manager-change history', () => {
    const closed = data.attachments.filter((attachment) => attachment.endedAt !== null);
    expect(closed.length).toBeGreaterThan(0);
  });
});
