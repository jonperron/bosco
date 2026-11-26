import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'bosco.language';

// Called inside the try blocks: blocked storage (cookies disabled, sandboxed
// iframe) throws a SecurityError on merely reading `localStorage`.
function resolveStorage(storage: Storage | null | undefined): Storage | null {
  return storage === undefined ? globalThis.localStorage : storage;
}

/** Reads the stored language, falling back to fr (the default of the socle). */
export function readStoredLanguage(storage?: Storage | null): SupportedLanguage {
  try {
    const stored = resolveStorage(storage)?.getItem(STORAGE_KEY);
    return stored !== null &&
      stored !== undefined &&
      SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)
      ? (stored as SupportedLanguage)
      : 'fr';
  } catch (error) {
    // localStorage access can fail (private browsing, storage full, etc.)
    // Fall back to the default language
    console.warn('[i18n] Failed to read stored language from localStorage:', error);
    return 'fr';
  }
}

/** Keeps the document lang in sync, for screen readers and spell check. */
// `string` (not SupportedLanguage) because applyDocumentLanguage also
// receives i18next.language, which i18next types as string.
function applyDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', language);
  }
}

/**
 * The default i18next instance of the app, initialised synchronously from
 * the bundled resources. Every user-visible string reads from it.
 */
export const i18n: I18n = i18next.use(initReactI18next);

if (!i18next.isInitialized) {
  const initialLanguage = readStoredLanguage();
  void i18next
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng: initialLanguage,
      fallbackLng: 'fr',
      interpolation: { escapeValue: false },
      initAsync: false,
    })
    .then(() => applyDocumentLanguage(initialLanguage));
}

/** Switches the language, persists the choice and keeps the document in sync. */
export function changeLanguage(
  language: SupportedLanguage,
  storage?: Storage | null,
): Promise<void> {
  return i18next
    .changeLanguage(language)
    .then(() => {
      // Always keep the document in sync after the language switch succeeds
      applyDocumentLanguage(i18next.language ?? language);

      // Try to persist the choice, but don't let storage failures
      // prevent the language switch from completing
      try {
        resolveStorage(storage)?.setItem(STORAGE_KEY, language);
      } catch (error) {
        console.warn('[i18n] Failed to persist language preference to localStorage:', error);
        // Continue without failing - the language switch succeeded
      }
    })
    .then(() => undefined);
}
