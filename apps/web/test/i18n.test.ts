import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changeLanguage,
  readStoredLanguage,
  SUPPORTED_LANGUAGES,
  i18n as i18nStore,
} from '../src/i18n';

// Read before any timer can run: the first render must already be translated.
const initialisedAtImport = i18nStore.isInitialized;

describe('i18n module', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is initialised synchronously at import', () => {
    expect(initialisedAtImport).toBe(true);
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

  describe('when the browser blocks storage', () => {
    // Blocked storage (cookies disabled, sandboxed iframe) throws on mere access.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
    });

    afterEach(() => {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      vi.restoreAllMocks();
    });

    it('readStoredLanguage falls back to fr', () => {
      expect(readStoredLanguage()).toBe('fr');
      expect(console.warn).toHaveBeenCalled();
    });

    it('changeLanguage still switches the language', async () => {
      await changeLanguage('en');
      expect(i18nStore.language).toBe('en');
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
