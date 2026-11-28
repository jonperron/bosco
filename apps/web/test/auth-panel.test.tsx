import AuthPanel from '../src/auth-panel';
import { i18n } from '../src/i18n';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Account = { id: string; email: string; displayName: string };
type MeResult = { data: Account | undefined; response: { status: number } };
type LogoutResult = { error: unknown; response: { status: number; ok: boolean } };

const account: Account = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'manager@example.com',
  displayName: 'Alex Martin',
};

const mocks = vi.hoisted(() => ({
  get: vi.fn((): Promise<MeResult> =>
    Promise.resolve({ data: undefined, response: { status: 401 } }),
  ),
  post: vi.fn((): Promise<LogoutResult> =>
    Promise.resolve({ error: undefined, response: { status: 204, ok: true } }),
  ),
}));

vi.mock('@bosco/api-client', () => ({
  createApiClient: () => ({ GET: mocks.get, POST: mocks.post }),
}));

function signedIn() {
  mocks.get.mockResolvedValue({ data: account, response: { status: 200 } });
}

describe('AuthPanel', () => {
  beforeEach(async () => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({ data: undefined, response: { status: 401 } });
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ error: undefined, response: { status: 204, ok: true } });
    window.history.replaceState(null, '', '/');
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('signed out: offers a sign-in link that navigates to the API login route', async () => {
    render(<AuthPanel />);

    const link = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(link.getAttribute('href')).toBe('/api/auth/login');
    expect(mocks.get).toHaveBeenCalledWith('/api/auth/me');
  });

  it('signed in: shows the manager and a sign-out button', async () => {
    signedIn();
    render(<AuthPanel />);

    expect(await screen.findByText(/Alex Martin/)).toBeDefined();
    expect(screen.getByText(/manager@example\.com/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in with Google' })).toBeNull();
  });

  it('signing out calls logout, then shows the signed-out state with focus on sign-in', async () => {
    signedIn();
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(mocks.post).toHaveBeenCalledWith('/api/auth/logout');
    const link = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(document.activeElement).toBe(link);
    expect(screen.getByRole('status').textContent).toBe('You are signed out.');
    expect(screen.queryByText(/Alex Martin/)).toBeNull();
  });

  it('a failed sign-out keeps the manager signed in and says so', async () => {
    signedIn();
    mocks.post.mockResolvedValue({ error: {}, response: { status: 403, ok: false } });
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toMatch(/could not sign you out/i);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('a sign-out that cannot reach the API keeps the manager signed in', async () => {
    signedIn();
    mocks.post.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not sign you out/i);
  });

  it.each([
    ['denied', /not allowed to sign in/],
    ['failed', /Sign-in failed\. Please try again/],
  ])('auth_error=%s: shows a short message and cleans the query string', async (code, message) => {
    window.history.replaceState(null, '', `/?auth_error=${code}&keep=1#top`);
    render(<AuthPanel />);

    expect((await screen.findByRole('alert')).textContent).toMatch(message);
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#top');
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toBeDefined();
  });

  it('ignores an unknown auth_error code but still cleans it', async () => {
    window.history.replaceState(null, '', '/?auth_error=<b>x</b>');
    render(<AuthPanel />);

    await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('when the session check fails, says so and still offers sign-in', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    render(<AuthPanel />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not check/i);
    expect(screen.getByRole('link', { name: 'Sign in with Google' })).toBeDefined();
  });

  it('a refused sign-in message is not replaced by a failed session check', async () => {
    window.history.replaceState(null, '', '/?auth_error=denied');
    mocks.get.mockRejectedValue(new Error('offline'));
    render(<AuthPanel />);

    await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(screen.getByRole('alert').textContent).toMatch(/not allowed to sign in/);
  });

  it('a non-401 error from the session check is reported, not taken as signed out', async () => {
    mocks.get.mockResolvedValue({ data: undefined, response: { status: 500 } });
    render(<AuthPanel />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not check/i);
  });

  it('is translated into French', async () => {
    await i18n.changeLanguage('fr');
    render(<AuthPanel />);

    expect(await screen.findByRole('link', { name: 'Se connecter avec Google' })).toBeDefined();
  });

  it('announces the session check while it runs', async () => {
    let resolve: (value: MeResult) => void = () => undefined;
    mocks.get.mockReturnValue(new Promise<MeResult>((r) => (resolve = r)));
    render(<AuthPanel />);

    expect(screen.getByRole('status').textContent).toMatch(/Checking your session/);
    resolve({ data: undefined, response: { status: 401 } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''));
  });
});
