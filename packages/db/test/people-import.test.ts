import { describe, expect, it } from 'vitest';
import { parsePeopleCsv, PeopleCsvError } from '../src/people-import.js';

// Fictitious records on the reserved example.com domain (RFC 2606).
const HEADER = 'display_name,email,manager_email';

function problemsOf(text: string) {
  try {
    parsePeopleCsv(text);
  } catch (error) {
    if (error instanceof PeopleCsvError) return error.problems;
    throw error;
  }
  throw new Error('expected the file to be rejected');
}

describe('parsePeopleCsv', () => {
  it('reads rows, trimming values and treating an empty manager as none', () => {
    const rows = parsePeopleCsv(
      `${HEADER}\r\n Ada Alpha , ada@example.com ,\r\n"Bo, Beta",bo@example.com,ADA@example.com\r\n`,
    );
    expect(rows).toEqual([
      { line: 2, displayName: 'Ada Alpha', email: 'ada@example.com', managerEmail: null },
      {
        line: 3,
        displayName: 'Bo, Beta',
        email: 'bo@example.com',
        managerEmail: 'ADA@example.com',
      },
    ]);
  });

  it('accepts columns in any order and case, without the optional manager column', () => {
    expect(parsePeopleCsv('EMAIL,Display_Name\nada@example.com,Ada\n')).toEqual([
      { line: 2, displayName: 'Ada', email: 'ada@example.com', managerEmail: null },
    ]);
  });

  it('accepts a header with no rows, and skips blank lines', () => {
    expect(parsePeopleCsv(`${HEADER}\n`)).toEqual([]);
    expect(parsePeopleCsv(`${HEADER}\n\nAda,ada@example.com,\n`)).toHaveLength(1);
  });

  it('rejects an empty file', () => {
    expect(problemsOf('')).toEqual([{ line: 1, message: expect.stringMatching(/header/) }]);
  });

  it('rejects missing, unknown and repeated columns', () => {
    expect(problemsOf('display_name\nAda\n')).toEqual([
      { line: 1, message: 'missing column email' },
    ]);
    expect(problemsOf('display_name,email,team\n')).toEqual([
      { line: 1, message: 'unknown column team' },
    ]);
    expect(problemsOf('display_name,email,email\n')).toEqual([
      { line: 1, message: 'repeated column email' },
    ]);
  });

  it('lists every invalid line at once', () => {
    const text = [
      HEADER,
      'Ada,ada@example.com,',
      ',empty-name@example.com,',
      'No Email,,',
      'Bad,not-an-email,',
      'Bad Manager,bm@example.com,nope',
      'Self,self@example.com,SELF@example.com',
      'Copy,Ada@Example.com,',
      'Short,short@example.com',
    ].join('\n');
    expect(problemsOf(text)).toEqual([
      { line: 3, message: 'display_name is empty' },
      { line: 4, message: 'email is empty' },
      { line: 5, message: 'email is malformed' },
      { line: 6, message: 'manager_email is malformed' },
      { line: 7, message: 'a person cannot be their own manager' },
      { line: 8, message: 'email duplicates line 2' },
      { line: 9, message: 'expected 3 fields, found 2' },
    ]);
  });

  it('reports a CSV syntax error with its line', () => {
    expect(problemsOf(`${HEADER}\nAda,ada@example.com,\n"open,x,y\n`)).toEqual([
      { line: 3, message: 'unterminated quoted field' },
    ]);
  });

  it('names the lines in the error message, but no value from the file', () => {
    const error = (() => {
      try {
        parsePeopleCsv(`${HEADER}\nAda,secret@example.com,\nAda,secret@example.com,\n`);
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(PeopleCsvError);
    expect(String(error)).toMatch(/line 3: email duplicates line 2/);
    expect(String(error)).not.toMatch(/secret/);
  });
});
