import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomMenu } from './room-menu';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

function player(id: string, name: string, isGuest = false) {
    return { id, presenceId: id, name, avatarUrl: '', isGuest, presence: 0 };
}

describe('RoomMenu', () => {
    it("shows each person's avatar in the list", async () => {
        const user = userEvent.setup();
        const ctx = {
            sessionExpired: false,
            snapshot: {
                room: {
                    id: 'r1',
                    isIcebreaker: false,
                    isHost: true,
                    canManage: true,
                    canDelete: false,
                    canBecomeHost: false,
                },
                me: { playerId: 'ada' },
                players: [
                    player('ada', 'Ada'),
                    player('bob', 'Bob'),
                    player('gus', 'Gus', true),
                ],
            },
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomMenu />
            </RoomProvider>,
        );

        await user.click(screen.getByRole('button', { name: 'Room menu' }));
        await user.click(
            screen.getByRole('menuitem', { name: 'Hand over hosting' }),
        );

        const bob = await screen.findByRole('menuitem', { name: 'Bob' });

        expect(bob.querySelector('[data-slot="person-avatar"]')).not.toBeNull();
        expect(screen.queryByRole('menuitem', { name: 'Gus' })).toBeNull();
    });
});
