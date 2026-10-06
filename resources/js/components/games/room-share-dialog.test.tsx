import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomShareDialog } from './room-share-dialog';

const api = vi.hoisted(() => ({ retroRequest: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

function renderDialog(
    players: { id: string; isGuest: boolean }[],
    joinCode: string | null = null,
) {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
        snapshot: {
            room: {
                id: 'r1',
                name: 'Lunch',
                teamName: 'Atlas',
                access: 'link',
                guestUrl: 'https://skrum.test/play/token',
                joinCode,
                canManage: true,
            },
            share: {},
            deliveries: [],
            players,
        },
        online: [],
        run: <T,>(mutation: Promise<T>) => mutation,
        refetch,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoomShareDialog open onOpenChange={vi.fn()} />
        </RoomProvider>,
    );

    return { refetch };
}

beforeEach(() => {
    api.retroRequest.mockReset();
    api.retroRequest.mockResolvedValue(null);
});

describe('RoomShareDialog', () => {
    it('shows the session code and where to enter it', () => {
        renderDialog([], 'K7Q-P4M2');

        expect(screen.getByText('K7Q-P4M2')).toBeTruthy();
        expect(
            screen.getByText(`Join at ${window.location.host}/join`),
        ).toBeTruthy();
    });

    it('shows no session code without one', () => {
        renderDialog([]);

        expect(screen.queryByText('Session code')).toBeNull();
    });

    it('asks before turning guests off while a guest is in the room, and sends nothing on Cancel', async () => {
        renderDialog([
            { id: 'p1', isGuest: false },
            { id: 'p2', isGuest: true },
        ]);

        await userEvent.click(
            screen.getByRole('switch', {
                name: /Allow guests without an account/,
            }),
        );

        const confirm = screen.getByRole('alertdialog');

        expect(confirm.textContent).toContain(
            'Guests in this room lose access.',
        );
        expect(api.retroRequest).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        expect(api.retroRequest).not.toHaveBeenCalled();
    });

    it('turns guests off once confirmed', async () => {
        const { refetch } = renderDialog([{ id: 'p2', isGuest: true }]);

        await userEvent.click(
            screen.getByRole('switch', {
                name: /Allow guests without an account/,
            }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Turn off guest access' }),
        );

        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(api.retroRequest).toHaveBeenCalledTimes(1);
        expect(api.retroRequest.mock.calls[0][1]).toEqual({ access: 'team' });
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('turns guests off at once when no guest is in the room', async () => {
        renderDialog([{ id: 'p1', isGuest: false }]);

        await userEvent.click(
            screen.getByRole('switch', {
                name: /Allow guests without an account/,
            }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        await waitFor(() =>
            expect(api.retroRequest.mock.calls[0][1]).toEqual({
                access: 'team',
            }),
        );
    });
});
