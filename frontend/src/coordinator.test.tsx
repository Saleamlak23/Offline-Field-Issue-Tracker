import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConnectivityProvider } from './connectivity.js';
import { CoordinatorReportDetail } from './pages/Coordinator.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('coordinator transitions', () => {
  it('shows only Reopen for a resolved report', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 17,
        clientId: 'a1b2c3d4-e5f6-4789-8123-abcdef012345',
        category: 'water',
        description: 'Broken pipe beside the school.',
        location: 'North sector, school',
        priority: 'high',
        status: 'resolved',
        reportedAt: new Date().toISOString(),
        revision: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [],
      }),
    }));

    render(
      <ConnectivityProvider>
        <MemoryRouter initialEntries={['/coordinator/reports/17']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes><Route path="/coordinator/reports/:id" element={<CoordinatorReportDetail />} /></Routes>
        </MemoryRouter>
      </ConnectivityProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
});
