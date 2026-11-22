import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../src/home-page';
import { i18n } from '../src/i18n';

const healthResponses: Array<{
  data?: { status: 'ok'; version: string; uptimeSeconds: number };
  error?: unknown;
}> = [];

vi.mock('@bosco/api-client', () => ({
  createApiClient: () => ({
    GET: async () =>
      healthResponses[0] ?? {
        data: { status: 'ok', version: '0.0.1', uptimeSeconds: 12 },
        error: undefined,
      },
  }),
}));

describe('HomePage', () => {
  beforeEach(async () => {
    healthResponses.length = 0;
    window.localStorage.clear();
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
      expect(screen.getByText(/v0\.0\.1/)).toBeDefined();
    });
    expect(screen.getByText(/12/)).toBeDefined();
  });

  it('switches the interface to English on demand', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByText(/foundation of your management tooling/)).toBeDefined();
    expect(screen.queryByText(/socle de votre outillage/)).toBeNull();
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
    healthResponses.push({ error: { message: 'network down' } });
    render(<HomePage />);

    expect(await screen.findByText(/Service indisponible/)).toBeDefined();
  });
});
