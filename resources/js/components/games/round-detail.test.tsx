import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoundDetail } from './round-detail';

const api = vi.hoisted(() => ({ retroRequest: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

function renderDetail(message: string | null) {
    api.retroRequest.mockRejectedValue(new Error('refused'));

    const handleError = vi.fn(() => message);
    const ctx = {
        snapshot: { room: { id: 'room' } },
        handleError,
        sessionExpired: message === null,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoundDetail roundId="round" />
        </RoomProvider>,
    );

    return { handleError };
}

describe('RoundDetail', () => {
    it('says why the round could not be loaded', async () => {
        renderDetail('Slow down a little.');

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Slow down a little.',
        );
    });

    it('stays silent once the session has expired', async () => {
        const { handleError } = renderDetail(null);

        await waitFor(() => expect(handleError).toHaveBeenCalled());

        expect(screen.queryByRole('alert')).toBeNull();
    });
});
