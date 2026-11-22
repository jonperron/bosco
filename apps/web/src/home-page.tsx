import { createApiClient } from '@bosco/api-client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { changeLanguage } from './i18n';
import type { SupportedLanguage } from './i18n';

/**
 * The single API client of the app. Every HTTP call must go through it:
 * a hand-written fetch would bypass the committed OpenAPI contract.
 */
const apiClient = createApiClient(import.meta.env['VITE_API_BASE_URL'] ?? '');

export interface HealthState {
  kind: 'loading' | 'ok' | 'error';
  version?: string;
  uptimeSeconds?: number;
}

/** Loads the health payload through the typed client. */
export async function loadHealth(): Promise<HealthState> {
  const { data } = await apiClient.GET('/api/health');
  if (data === undefined) {
    return { kind: 'error' };
  }
  return { kind: 'ok', version: data.version, uptimeSeconds: data.uptimeSeconds };
}

export default function HomePage() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  const refresh = useCallback(async () => {
    setHealth({ kind: 'loading' });
    setHealth(await loadHealth());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchLanguage = (language: SupportedLanguage) => {
    void changeLanguage(language);
  };

  return (
    <main>
      <h1>Bosco</h1>
      <p>{t('home.tagline')}</p>

      <section>
        <h2>{t('home.language')}</h2>
        <div>
          <button type="button" onClick={() => switchLanguage('fr')}>
            Français
          </button>
          <button type="button" onClick={() => switchLanguage('en')}>
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
