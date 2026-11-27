/** One CSV record and the line of the file it starts on (1-based). */
export interface CsvRecord {
  readonly line: number;
  readonly fields: readonly string[];
}

export class CsvSyntaxError extends Error {
  constructor(
    readonly line: number,
    readonly reason: string,
  ) {
    super(`line ${line}: ${reason}`);
    this.name = 'CsvSyntaxError';
  }
}

/**
 * Parses RFC 4180 CSV: comma-separated, records ending in CRLF (LF or CR also accepted), fields
 * optionally quoted, a doubled quote standing for one quote. Strict on stray quotes.
 */
export function parseCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    records.push({ line: recordLine, fields: [...fields, field] });
    fields = [];
    field = '';
    closedQuote = false;
  };

  // A leading byte order mark, as spreadsheet exports write it, is not data.
  for (let index = text.startsWith('﻿') ? 1 : 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
    } else if (char === ',') {
      fields.push(field);
      field = '';
      closedQuote = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else if (char === '"') {
      if (field !== '' || closedQuote) throw new CsvSyntaxError(line, 'unexpected quote');
      quoted = true;
    } else {
      if (closedQuote) throw new CsvSyntaxError(line, 'text after a closing quote');
      field += char;
    }
  }
  if (quoted) throw new CsvSyntaxError(recordLine, 'unterminated quoted field');
  // A final line break ends the last record; nothing follows it.
  if (field !== '' || fields.length > 0 || closedQuote) endRecord();
  return records;
}
