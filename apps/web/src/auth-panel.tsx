import type { ApiPaths } from '@bosco/api-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_BASE_URL, apiClient } from './api';

type Account = ApiPaths['/api/auth/me']['get']['responses'][200]['content']['application/json'];

type Session =
  { kind: 'checking' } | { kind: 'signedOut' } | { kind: 'signedIn'; account: Account };

type Problem = 'denied' | 'failed' | 'checkFailed' | 'signOutFailed';

const AUTH_ERROR_PARAM = 'auth_error';

/** The refusal code the API put in the URL after a sign-in attempt; anything else is ignored. */
function readAuthError(): Problem | null {
  const code = new URLSearchParams(window.location.search).get(AUTH_ERROR_PARAM);
  return code === 'denied' || code === 'failed' ? code : null;
}

/** Removes auth_error from the address bar, so a reload or a shared link does not replay it. */
function clearAuthError(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(AUTH_ERROR_PARAM)) return;
  url.searchParams.delete(AUTH_ERROR_PARAM);
  window.history.replaceState(window.history.state, '', url);
}

/** Asks the API who is signed in: 401 means nobody, any other failure is a problem. */
async function loadSession(): Promise<Session | null> {
  try {
    const { data, response } = await apiClient.GET('/api/auth/me');
    if (data !== undefined) return { kind: 'signedIn', account: data };
    return response.status === 401 ? { kind: 'signedOut' } : null;
  } catch {
    return null;
  }
}

async function signOut(): Promise<boolean> {
  try {
    const { response } = await apiClient.POST('/api/auth/logout');
    return response.ok;
  } catch {
    return false;
  }
}

/** Sign-in and sign-out of the manager, from the session cookie the API sets. */
export default function AuthPanel() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session>({ kind: 'checking' });
  const [problem, setProblem] = useState<Problem | null>(readAuthError);
  const [justSignedOut, setJustSignedOut] = useState(false);
  const signInLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    clearAuthError();
    let active = true;
    void loadSession().then((loaded) => {
      if (!active) return;
      setSession(loaded ?? { kind: 'signedOut' });
      // A refused sign-in says more than a failed check: keep it on screen.
      if (loaded === null) setProblem((shown) => shown ?? 'checkFailed');
    });
    return () => {
      active = false;
    };
  }, []);

  // The sign-out button is gone once signed out: keep keyboard focus in the panel.
  useEffect(() => {
    if (justSignedOut) signInLink.current?.focus();
  }, [justSignedOut]);

  const handleSignOut = async () => {
    if (await signOut()) {
      setProblem(null);
      setSession({ kind: 'signedOut' });
      setJustSignedOut(true);
    } else {
      setProblem('signOutFailed');
    }
  };

  let status = '';
  if (session.kind === 'checking') status = t('home.auth.checking');
  else if (session.kind === 'signedOut' && justSignedOut) status = t('home.auth.signedOut');

  return (
    <section>
      <h2>{t('home.auth.title')}</h2>
      <p role="status">{status}</p>
      {problem !== null && <p role="alert">{t(`home.auth.problem.${problem}`)}</p>}
      {session.kind === 'signedOut' && (
        // A full-page navigation: the API redirects to Google, then back to the app.
        <a ref={signInLink} href={`${API_BASE_URL}/api/auth/login`}>
          {t('home.auth.signIn')}
        </a>
      )}
      {session.kind === 'signedIn' && (
        <>
          <p>
            {t('home.auth.signedInAs', {
              name: session.account.displayName,
              email: session.account.email,
            })}
          </p>
          <button type="button" onClick={() => void handleSignOut()}>
            {t('home.auth.signOut')}
          </button>
        </>
      )}
    </section>
  );
}
