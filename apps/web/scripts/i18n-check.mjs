#!/usr/bin/env node
// Checks that every locale file exposes the same key set, so a missing
// translation cannot ship. No preference between fr and en: both must be
// complete.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const localeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const locales = ['fr', 'en'];

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object') {
    return new Set([prefix]);
  }
  const keys = new Set();
  for (const [childKey, childValue] of Object.entries(value)) {
    const nextPrefix = prefix === '' ? childKey : `${prefix}.${childKey}`;
    for (const flat of flattenKeys(childValue, nextPrefix)) {
      keys.add(flat);
    }
  }
  return keys;
}

const keySets = locales.map((locale) => {
  const raw = JSON.parse(readFileSync(path.join(localeDir, `${locale}.json`), 'utf8'));
  return { locale, keys: flattenKeys(raw) };
});

let mismatch = false;
for (let i = 1; i < keySets.length; i += 1) {
  const reference = keySets[0];
  const other = keySets[i];

  for (const key of reference.keys) {
    if (!other.keys.has(key)) {
      console.error(
        `${other.locale}.json misses key "${key}" (present in ${reference.locale}.json)`,
      );
      mismatch = true;
    }
  }
  for (const key of other.keys) {
    if (!reference.keys.has(key)) {
      console.error(
        `${reference.locale}.json misses key "${key}" (present in ${other.locale}.json)`,
      );
      mismatch = true;
    }
  }
}

console.log(
  mismatch
    ? 'i18n:check failed — locales are out of sync.'
    : `i18n:check ok — ${keySets[0].keys.size} keys in sync (${locales.join(', ')}).`,
);
process.exit(mismatch ? 1 : 0);
