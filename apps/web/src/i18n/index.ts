import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'bosco.language';

/** Reads the stored language, falling back to fr (the default of the socle). */
export function readStoredLanguage(
  storage: Storage | null = globalThis.localStorage,
): SupportedLanguage {
  const stored = storage?.getItem(STORAGE_KEY);
  return stored !== null &&
    stored !== undefined &&
    SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)
    ? (stored as SupportedLanguage)
    : 'fr';
}

/** Keeps the document lang in sync, for screen readers and spell check. */
function applyDocumentLanguage(language: SupportedLanguage | string): void {
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
      initImmediate: false,
    })
    .then(() => applyDocumentLanguage(initialLanguage));
}

/** Switches the language, persists the choice and keeps the document in sync. */
export function changeLanguage(
  language: SupportedLanguage,
  storage: Storage | null = globalThis.localStorage,
): Promise<void> {
  storage?.setItem(STORAGE_KEY, language);
  return i18next
    .changeLanguage(language)
    .then(() => {
      applyDocumentLanguage(i18next.language ?? language);
    })
    .then(() => undefined);
}
