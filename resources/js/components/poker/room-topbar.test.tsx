import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FacilitatorMenu,
    RoomStateBadges,
    RoomTimer,
    RoomTitle,
    ShareButton,
    TakeControlButton,
    TasksToggle,
    WatchSwitch,
} from '@/components/poker/room-topbar';
import { pokerRound, pokerSnapshot, renderInRoom } from '@/test/poker-room';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({ toast: vi.fn() }));

const inOneMinute = (): string => new Date(Date.now() + 60_000).toISOString();

beforeEach(() => {
    mocks.request.mockReset();
});

describe('RoomTitle', () => {
    it('lets the facilitator rename the game in place, and shows the deck', async () => {
        mocks.request.mockResolvedValue(null);

        const { ctx } = renderInRoom(<RoomTitle showDeck />);
        const field = screen.getByRole('textbox', { name: 'Game title' });

        expect((field as HTMLInputElement).value).toBe('Sprint 43 refinement');
        expect(screen.getByText('Fibonacci')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/atlas');

        fireEvent.change(field, { target: { value: ' Sprint 44 ' } });

        await act(async () => {
            fireEvent.blur(field);
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ title: 'Sprint 44' });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('shows the name as text to the others, without a back link for a guest', () => {
        renderInRoom(
            <RoomTitle showDeck={false} />,
            pokerSnapshot({
                me: { isFacilitator: false, isGuest: true },
                links: { team: null, decks: null },
            }),
        );

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 43 refinement',
        );
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText('Fibonacci')).toBeNull();
    });
});

describe('RoomStateBadges', () => {
    it('says which round is being voted, then that it is revealed', () => {
        const { unmount } = renderInRoom(<RoomStateBadges />);

        expect(screen.getByText('Round 1 · voting')).toBeTruthy();
        unmount();

        renderInRoom(
            <RoomStateBadges />,
            pokerSnapshot({
                game: { autoReveal: true, anonymousVotes: true },
                current: {
                    taskId: 't1',
                    round: pokerRound({
                        number: 2,
                        revealedAt: '2026-10-02T09:01:00Z',
                    }),
                },
            }),
        );

        expect(screen.getByText('Round 2 · revealed')).toBeTruthy();
        expect(screen.getByText('Auto-reveal')).toBeTruthy();
        expect(screen.getByText('Anonymous votes')).toBeTruthy();
    });

    it('says an ended game is ended, and nothing of its round', () => {
        renderInRoom(
            <RoomStateBadges />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(screen.getByText('Game ended')).toBeTruthy();
        expect(screen.queryByText(/Round 1/)).toBeNull();
    });
});

describe('RoomTimer', () => {
    it('gives the facilitator the timer menu and nobody else a control', () => {
        const { unmount } = renderInRoom(<RoomTimer />);

        expect(screen.getByRole('button', { name: 'Timer' })).toBeTruthy();
        expect(screen.queryByRole('timer')).toBeNull();
        unmount();

        const { container } = renderInRoom(
            <RoomTimer />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(container.firstChild).toBeNull();
    });

    it('offers 1, 3, 5 and 10 minutes and "Custom…", and no 30 seconds', async () => {
        renderInRoom(<RoomTimer />);

        const trigger = screen.getByRole('button', { name: 'Timer' });

        fireEvent.keyDown(trigger, { key: 'Enter' });

        const items = (await screen.findAllByRole('menuitem')).map(
            (item) => item.textContent,
        );

        expect(items).toEqual([
            '1 min',
            '3 min',
            '5 min',
            '10 min',
            'Custom…',
            'Stop timer',
        ]);
        expect(screen.queryByText('30 s')).toBeNull();
    });

    it('starts the chosen duration and applies the end the server answers', async () => {
        const endsAt = inOneMinute();

        mocks.request.mockResolvedValue({ timerEndsAt: endsAt });

        const { ctx } = renderInRoom(<RoomTimer />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Timer' }), {
            key: 'Enter',
        });

        await act(async () => {
            fireEvent.click(
                await screen.findByRole('menuitem', { name: '1 min' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ seconds: 60 });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'timer.set',
            roundId: 'round-1',
            timerEndsAt: endsAt,
        });
    });

    it('shows the countdown to everyone and "+2 min" to the facilitator, who extends the timer', async () => {
        const endsAt = inOneMinute();
        const extended = new Date(Date.now() + 180_000).toISOString();
        const running = pokerSnapshot({
            current: {
                taskId: 't1',
                round: pokerRound({ timerEndsAt: endsAt }),
            },
        });

        mocks.request.mockResolvedValue({ timerEndsAt: extended });

        const { ctx, unmount } = renderInRoom(<RoomTimer />, running);

        expect(screen.getByRole('timer')).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: '+2 min' }));
        });

        expect(mocks.request.mock.calls[0][0].url).toContain(
            '/rounds/round-1/timer/extension',
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'timer.set',
            roundId: 'round-1',
            timerEndsAt: extended,
        });
        unmount();

        renderInRoom(<RoomTimer />, {
            ...running,
            me: { ...running.me, isFacilitator: false },
        });

        expect(screen.getByRole('timer')).toBeTruthy();
        expect(screen.queryByRole('button', { name: '+2 min' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Timer' })).toBeNull();
    });

    it('shows no timer once the round is revealed or the game ended', () => {
        const { container } = renderInRoom(
            <RoomTimer />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: pokerRound({
                        timerEndsAt: inOneMinute(),
                        revealedAt: '2026-10-02T09:01:00Z',
                    }),
                },
            }),
        );

        expect(container.firstChild).toBeNull();
    });
});

describe('WatchSwitch', () => {
    it('is a switch named "Watch only" that the label toggles, and keeps its name when on', async () => {
        mocks.request.mockResolvedValue(null);

        const { ctx, unmount } = renderInRoom(<WatchSwitch />);
        const control = screen.getByRole('switch', { name: 'Watch only' });

        expect(control.getAttribute('aria-checked')).toBe('false');

        await act(async () => {
            fireEvent.click(screen.getByText('Watch only'));
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ spectator: true });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        unmount();

        renderInRoom(
            <WatchSwitch />,
            pokerSnapshot({ me: { isSpectator: true, canVote: false } }),
        );

        expect(
            screen
                .getByRole('switch', { name: 'Watch only' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('is absent on an ended game', () => {
        const { container } = renderInRoom(
            <WatchSwitch />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(container.firstChild).toBeNull();
    });
});

describe('TasksToggle', () => {
    it('hides and shows the side panel on a wide screen', () => {
        const onCollapsedChange = vi.fn();
        const { rerender } = renderWithProviders(
            <TasksToggle
                wide
                collapsed={false}
                onCollapsedChange={onCollapsedChange}
                onOpenDrawer={vi.fn()}
            />,
        );
        const hide = screen.getByRole('button', { name: 'Hide tasks' });

        expect(hide.getAttribute('aria-expanded')).toBe('true');
        expect(hide.hasAttribute('aria-pressed')).toBe(false);
        expect(hide.getAttribute('aria-controls')).toBe('poker-tasks');

        fireEvent.click(hide);

        expect(onCollapsedChange).toHaveBeenCalledWith(true);

        rerender(
            <TasksToggle
                wide
                collapsed
                onCollapsedChange={onCollapsedChange}
                onOpenDrawer={vi.fn()}
            />,
        );

        const show = screen.getByRole('button', { name: 'Show tasks' });

        expect(show.getAttribute('aria-expanded')).toBe('false');
        expect(show.hasAttribute('aria-controls')).toBe(false);
    });

    it('opens the drawer on a narrow screen', () => {
        const onOpenDrawer = vi.fn();
        renderWithProviders(
            <TasksToggle
                wide={false}
                collapsed={false}
                onCollapsedChange={vi.fn()}
                onOpenDrawer={onOpenDrawer}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

        expect(onOpenDrawer).toHaveBeenCalledTimes(1);
    });
});

describe('TakeControlButton', () => {
    it('is shown to who may take control and asks the server for it', async () => {
        mocks.request.mockResolvedValue(null);

        const { unmount } = renderInRoom(<TakeControlButton />);

        expect(
            screen.queryByRole('button', { name: 'Take control' }),
        ).toBeNull();
        unmount();

        const { ctx } = renderInRoom(
            <TakeControlButton />,
            pokerSnapshot({
                me: { isFacilitator: false, canTakeControl: true },
            }),
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Take control' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ user_id: 'user-ada' });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });
});

async function menuItems(): Promise<(string | null)[]> {
    fireEvent.keyDown(
        screen.getByRole('button', { name: 'Facilitator menu' }),
        {
            key: 'Enter',
        },
    );

    return (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent,
    );
}

const slackOnly = {
    slack: true,
    telegram: false,
    msteams: false,
    mattermost: false,
    webhook: false,
};

describe('FacilitatorMenu', () => {
    it('lists settings, hand-over, end and delete, and no guest link entry', async () => {
        const onChoose = vi.fn();

        renderInRoom(
            <FacilitatorMenu shareInMenu={false} onChoose={onChoose} />,
        );

        expect(await menuItems()).toEqual([
            'Settings…',
            'Hand over facilitation…',
            'End game',
            'Delete game…',
        ]);

        fireEvent.click(screen.getByRole('menuitem', { name: 'Settings…' }));

        expect(onChoose).toHaveBeenCalledWith('settings');
    });

    it('lists "Share…" when a channel is connected, or where the header has no Share button', async () => {
        const { unmount } = renderInRoom(
            <FacilitatorMenu shareInMenu={false} onChoose={vi.fn()} />,
            pokerSnapshot({ share: slackOnly }),
        );

        expect((await menuItems())[0]).toBe('Share…');
        unmount();

        const onChoose = vi.fn();

        renderInRoom(<FacilitatorMenu shareInMenu onChoose={onChoose} />);

        expect((await menuItems())[0]).toBe('Share…');

        fireEvent.click(screen.getByRole('menuitem', { name: 'Share…' }));

        expect(onChoose).toHaveBeenCalledWith('share');
    });

    it('reopens an ended game from the menu, which then offers nothing else but delete', async () => {
        mocks.request.mockResolvedValue(null);

        const { ctx } = renderInRoom(
            <FacilitatorMenu shareInMenu onChoose={vi.fn()} />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(await menuItems()).toEqual(['Reopen game', 'Delete game…']);

        await act(async () => {
            fireEvent.click(
                screen.getByRole('menuitem', { name: 'Reopen game' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ ended: false });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('gives a workspace admin who does not facilitate the delete entry only, and nobody else a menu', async () => {
        const { unmount } = renderInRoom(
            <FacilitatorMenu shareInMenu={false} onChoose={vi.fn()} />,
            pokerSnapshot({ me: { isFacilitator: false, canDelete: true } }),
        );

        expect(await menuItems()).toEqual(['Delete game…']);
        unmount();

        const { container } = renderInRoom(
            <FacilitatorMenu shareInMenu={false} onChoose={vi.fn()} />,
            pokerSnapshot({ me: { isFacilitator: false, canDelete: false } }),
        );

        expect(container.firstChild).toBeNull();
    });
});

describe('ShareButton', () => {
    it("is the facilitator's, while the game runs", () => {
        const onClick = vi.fn();
        const { unmount } = renderInRoom(<ShareButton onClick={onClick} />);

        fireEvent.click(screen.getByRole('button', { name: 'Share' }));

        expect(onClick).toHaveBeenCalledTimes(1);
        unmount();

        const ended = renderInRoom(
            <ShareButton onClick={onClick} />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(ended.container.firstChild).toBeNull();
        ended.unmount();

        const { container } = renderInRoom(
            <ShareButton onClick={onClick} />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(container.firstChild).toBeNull();
    });
});
