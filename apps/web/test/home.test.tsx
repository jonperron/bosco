import HomePage from '../src/home-page';
import { i18n } from '../src/i18n';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type GetResult = {
  data: { status: string; version: string; uptimeSeconds: number } | undefined;
  error: { message: string } | undefined;
};

const mocks = vi.hoisted(() => {
  const healthPayload = { status: 'ok', version: '0.0.1', uptimeSeconds: 12 };
  return {
    get: vi.fn((): Promise<GetResult> =>
      Promise.resolve({ data: healthPayload, error: undefined }),
    ),
  };
});

vi.mock('@bosco/api-client', () => ({
  createApiClient: () => ({
    GET: mocks.get,
  }),
}));

// The panel has its own tests (auth-panel.test.tsx); here only its placement matters.
vi.mock('../src/auth-panel', () => ({ default: () => <section aria-label="auth-panel" /> }));

describe('HomePage', () => {
  beforeEach(async () => {
    mocks.get.mockClear();
    window.localStorage.clear();
    document.documentElement.removeAttribute('lang');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the French tagline and a healthy service in French by default', async () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Bosco' })).toBeDefined();
    expect(await screen.findByText(/socle de votre outillage managérial/)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/démarré il y a 12 s/)).toBeDefined();
    });
    expect(screen.getByText(/v0\.0\.1/)).toBeDefined();
  });

  it('shows the sign-in panel', async () => {
    render(<HomePage />);

    expect(screen.getByRole('region', { name: 'auth-panel' })).toBeDefined();
    expect(await screen.findByText(/démarré il y a 12 s/)).toBeDefined();
  });

  it('calls the health route through the typed client contract path', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith('/api/health');
    });
  });

  it('switches the interface to English on demand, including the document language', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByText(/foundation of your management tooling/)).toBeDefined();
    expect(screen.queryByText(/socle de votre outillage/)).toBeNull();
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('marks the active language for assistive technology', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const french = screen.getByRole('button', { name: 'Français' });
    const english = screen.getByRole('button', { name: 'English' });
    expect(french.getAttribute('aria-pressed')).toBe('true');
    expect(english.getAttribute('aria-pressed')).toBe('false');

    await user.click(english);
    expect(english.getAttribute('aria-pressed')).toBe('true');
    expect(french.getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the language across a fresh render', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<HomePage />);

    await user.click(screen.getByRole('button', { name: 'English' }));
    unmount();
    render(<HomePage />);

    expect(await screen.findByText(/foundation of your management tooling/)).toBeDefined();
  });

  it('shows an error state when the health call fails', async () => {
    mocks.get.mockImplementationOnce(async () => ({
      data: undefined,
      error: { message: 'network down' },
    }));
    render(<HomePage />);

    expect(await screen.findByText(/Service indisponible/)).toBeDefined();
  });

  it('shows the error state also when the transport itself fails', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    render(<HomePage />);

    expect(await screen.findByText(/Service indisponible/)).toBeDefined();
  });
});
