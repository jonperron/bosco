import { describe, expect, it } from 'vitest';
import { CsvSyntaxError, parseCsv } from '../src/csv.js';

const fields = (text: string) => parseCsv(text).map((record) => record.fields);

describe('parseCsv', () => {
  it('splits records on CRLF, LF or CR and ignores one trailing line break', () => {
    expect(fields('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(fields('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(fields('a\rb\r')).toEqual([['a'], ['b']]);
  });

  it('keeps empty fields, including a trailing one', () => {
    expect(fields('a,,c\n,\n')).toEqual([
      ['a', '', 'c'],
      ['', ''],
    ]);
  });

  it('reads quoted fields holding commas, line breaks and doubled quotes', () => {
    expect(fields('"a,b","line\r\nbreak","say ""hi""",""\n')).toEqual([
      ['a,b', 'line\r\nbreak', 'say "hi"', ''],
    ]);
  });

  it('numbers each record by the line it starts on', () => {
    const records = parseCsv('h\n"two\nlines"\nnext\n');
    expect(records.map((record) => record.line)).toEqual([1, 2, 4]);
  });

  it('returns no record for an empty text and skips a byte order mark', () => {
    expect(parseCsv('')).toEqual([]);
    expect(fields('﻿a,b\n')).toEqual([['a', 'b']]);
  });

  it.each([
    ['an unterminated quoted field', 'a\n"open,b\n', 2],
    ['a quote inside an unquoted field', 'a\nb"c\n', 2],
    ['text after a closing quote', 'a\n"b"c\n', 2],
  ])('rejects %s with its line number', (_case, text, line) => {
    expect(() => parseCsv(text)).toThrow(CsvSyntaxError);
    expect(() => parseCsv(text)).toThrow(expect.objectContaining({ line }));
  });
});
