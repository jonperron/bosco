import { beforeEach, describe, expect, it } from 'vitest';

import {
  changeLanguage,
  readStoredLanguage,
  SUPPORTED_LANGUAGES,
  i18n as i18nStore,
} from '../src/i18n';

describe('i18n module', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exposes exactly fr and en', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['fr', 'en']);
  });

  it('falls back to fr without any storage', () => {
    expect(readStoredLanguage(null)).toBe('fr');
  });

  it('falls back to fr for an unsupported stored value', () => {
    window.localStorage.setItem('bosco.language', 'de');
    expect(readStoredLanguage()).toBe('fr');
  });

  it('reads back the language stored directly', () => {
    window.localStorage.setItem('bosco.language', 'en');
    expect(readStoredLanguage()).toBe('en');
  });

  it('changeLanguage persists and applies the new language', async () => {
    await changeLanguage('en');
    expect(readStoredLanguage()).toBe('en');
    expect(i18nStore.language).toBe('en');
  });
});
