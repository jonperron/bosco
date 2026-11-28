import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { apiClient } from './api';
import AuthPanel from './auth-panel';
import { changeLanguage } from './i18n';
import type { SupportedLanguage } from './i18n';

export interface HealthState {
  kind: 'loading' | 'ok' | 'error';
  version?: string;
  uptimeSeconds?: number;
}

/**
 * Loads the health payload through the typed client. Any failure — typed
 * error or transport rejection — maps to the error state: nothing at this
 * level is recoverable, the UI then shows the recovery hint.
 */
export async function loadHealth(): Promise<HealthState> {
  try {
    const { data, error } = await apiClient.GET('/api/health');
    if (data === undefined || error !== undefined) {
      return { kind: 'error' };
    }
    return { kind: 'ok', version: data.version, uptimeSeconds: data.uptimeSeconds };
  } catch {
    return { kind: 'error' };
  }
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  // Loads once per mount; a superseded answer (React StrictMode fires the
  // effect twice in dev) never wins the race.
  useEffect(() => {
    let active = true;
    setHealth({ kind: 'loading' });
    void loadHealth().then((state) => {
      if (active) {
        setHealth(state);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const switchLanguage = (language: SupportedLanguage) => {
    void changeLanguage(language);
  };

  // "Bosco" is the brand; Français/English are language autonyms — both
  // stay invariant across locales by convention, not by omission.
  return (
    <main>
      <h1>Bosco</h1>
      <p>{t('home.tagline')}</p>

      <AuthPanel />

      <section>
        <h2>{t('home.language')}</h2>
        <div>
          <button
            type="button"
            aria-pressed={i18n.language === 'fr'}
            onClick={() => switchLanguage('fr')}
          >
            Français
          </button>
          <button
            type="button"
            aria-pressed={i18n.language === 'en'}
            onClick={() => switchLanguage('en')}
          >
            English
          </button>
        </div>
      </section>

      <section>
        <h2>{t('home.health.title')}</h2>
        <p>
          {health.kind === 'loading' && t('home.health.loading')}
          {health.kind === 'ok' &&
            t('home.health.ok', {
              version: health.version,
              uptime: health.uptimeSeconds,
            })}
          {health.kind === 'error' && t('home.health.error')}
        </p>
      </section>
    </main>
  );
}
