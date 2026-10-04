import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '@/components/poker/game-context';
import { RoomView } from '@/components/poker/poker-room';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const viewport = vi.hoisted(() => ({ isPhone: false, isWide: true }));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => viewport.isPhone,
}));

vi.mock('@/hooks/use-min-width', () => ({
    useMinWidth: () => viewport.isWide,
}));

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    }),
}));

const room = <RoomView connected reconnecting={false} />;

beforeEach(() => {
    viewport.isPhone = false;
    viewport.isWide = true;
});

describe('RoomView, when the current task changes', () => {
    it('closes the edit dialog of the task that left', async () => {
        const snapshot = pokerSnapshot();
        const { ctx, rerender } = renderInRoom(room, snapshot);

        fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));

        const dialog = await screen.findByRole('dialog', { name: 'Edit task' });

        expect(
            dialog.querySelector<HTMLInputElement>('#poker-task-title')?.value,
        ).toBe('Login page');

        act(() => {
            rerender(
                <GameProvider
                    value={{
                        ...ctx,
                        snapshot: {
                            ...snapshot,
                            current: {
                                taskId: 't2',
                                round: snapshot.current!.round,
                            },
                        },
                    }}
                >
                    {room}
                </GameProvider>,
            );
        });

        expect(
            screen.getByRole('heading', { name: 'Password reset', level: 2 }),
        ).toBeTruthy();
        expect(screen.queryByRole('dialog', { name: 'Edit task' })).toBeNull();
    });
});

describe('RoomView for an observer', () => {
    it('says "You are observing this session." in place of the invitation to join the vote', () => {
        renderInRoom(
            room,
            pokerSnapshot({
                me: { isFacilitator: false, isSpectator: true, canVote: false },
                viewerIsObserver: true,
            }),
        );

        expect(
            screen.getByText('You are observing this session.'),
        ).toBeTruthy();
        expect(
            screen.queryByText("You're watching — switch to Play to vote"),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Join the vote' }),
        ).toBeNull();
    });

    it("keeps the facilitator's room for an observer who facilitates the game", () => {
        renderInRoom(room, pokerSnapshot({ viewerIsObserver: true }));

        expect(
            screen.queryByText('You are observing this session.'),
        ).toBeNull();
    });
});

describe('RoomView on a phone', () => {
    it('puts the settings button in the header, and in the bar under it on a phone', () => {
        const { unmount } = renderInRoom(room);

        expect(
            document.querySelector('header [aria-label="Game settings"]'),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'Game settings' }),
        ).toHaveLength(1);
        unmount();

        viewport.isPhone = true;
        viewport.isWide = false;

        renderInRoom(room);

        expect(
            document.querySelector(
                '[data-slot="poker-subbar"] [aria-label="Game settings"]',
            ),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'Game settings' }),
        ).toHaveLength(1);
    });

    it('keeps "Copy guest link" for a member who does not facilitate', () => {
        viewport.isPhone = true;
        viewport.isWide = false;

        renderInRoom(
            room,
            pokerSnapshot({
                game: {
                    guestAccessEnabled: true,
                    guestUrl: 'https://skrum.test/poker/join/token',
                },
                me: {
                    playerId: 'bob',
                    userId: 'user-bob',
                    isFacilitator: false,
                },
                tasks: [pokerTask('t1', 'Login page')],
            }),
        );

        expect(
            document
                .querySelector('[data-slot="poker-subbar"]')
                ?.querySelector('[aria-label="Copy guest link"]'),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'Copy guest link' }),
        ).toHaveLength(1);
    });
});

describe('RoomView, small details', () => {
    it('drops the watching banner once the game has ended', () => {
        renderInRoom(
            room,
            pokerSnapshot({
                game: { endedAt: '2026-10-02T10:00:00Z' },
                me: { isFacilitator: false, isSpectator: true, canVote: false },
            }),
        );

        expect(
            screen.queryByText("You're watching — switch to Play to vote"),
        ).toBeNull();
    });

    it('lets a phone hide its own cursor', () => {
        viewport.isPhone = true;
        viewport.isWide = false;

        renderInRoom(room, pokerSnapshot({ current: null }));

        expect(
            document
                .querySelector('[data-slot="poker-subbar"]')
                ?.querySelector('[aria-label="Hide my cursor"]'),
        ).toBeTruthy();
    });

    it('does not open the tasks drawer again by itself after the window widened', async () => {
        viewport.isWide = false;

        const { ctx, rerender } = renderInRoom(room);
        const again = () =>
            rerender(
                <GameProvider value={ctx}>
                    <RoomView connected reconnecting={false} />
                </GameProvider>,
            );

        fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

        expect(await screen.findByRole('dialog')).toBeTruthy();

        viewport.isWide = true;
        again();
        viewport.isWide = false;
        again();

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
