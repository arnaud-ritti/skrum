import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@/components/retro/board';
import { renderWithProviders } from '@/test/render';
import { boardContext, retroSnapshot } from '@/test/retro-board';

const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/hooks/use-retro-board', () => ({
    useRetroBoard: () => state.value,
}));

vi.mock('@/components/retro/icebreaker-game', async () => {
    const { GamePanel } = await import('@/components/games/game-panel');
    const { RoomProvider } = await import('@/components/games/room-context');

    return {
        IcebreakerGame: ({
            snapshot,
        }: {
            snapshot: { room: { id: string } };
        }) => (
            <RoomProvider value={{ snapshot, lastEnded: null } as never}>
                <section
                    aria-label="Icebreaker game"
                    data-room={snapshot.room.id}
                >
                    <GamePanel landmark={false} />
                </section>
            </RoomProvider>
        ),
    };
});

vi.mock('@/components/games/round-end-card', () => ({
    RoundEndCard: () => <p>Ready to play?</p>,
}));

vi.mock('@/components/games/room-sidebar', () => ({
    RoomSidebar: () => <p>Players</p>,
}));

function icebreakerSnapshot(
    icebreaker: unknown = { room: { id: 'room-1' }, round: null },
) {
    return retroSnapshot({
        retro: {
            phase: 'icebreaker',
            icebreakerEnabled: true,
            phases: [
                'icebreaker',
                'writing',
                'grouping',
                'voting',
                'discussing',
                'completed',
            ],
        },
        icebreaker: icebreaker as never,
    });
}

function given(
    overrides: Record<string, unknown> = {},
    snapshot = retroSnapshot(),
) {
    state.value = {
        ...boardContext(snapshot),
        status: 'active',
        connected: true,
        reconnecting: false,
        ...overrides,
    };

    return renderWithProviders(<Board snapshot={snapshot} />);
}

beforeEach(() => {
    state.value = {};
});

describe('Board', () => {
    it('renders the session shell: one realtime root, one main, the title, the phases, the people', () => {
        const { container } = given();

        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connected');
        expect(screen.getAllByRole('main')).toHaveLength(1);

        const header = container.querySelector('header') as HTMLElement;

        expect(header.querySelector('h1')?.textContent).toBe('Sprint 42');
        expect(header.querySelector('ol[aria-label="Phases"]')).not.toBeNull();
        expect(
            header.querySelector('[role="group"][aria-label="2 online"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeTruthy();
    });

    it('is still connecting until the presence channel has answered', () => {
        const { container } = given({ online: [] });

        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connecting');
    });

    it('makes the board inert under the expired banner', () => {
        const { container } = given({ sessionExpired: true });

        expect(screen.getByRole('alert').textContent).toContain(
            'Your session has expired.',
        );
        expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
        expect(
            container
                .querySelector('[data-slot="retro-body"]')
                ?.closest('[inert]'),
        ).not.toBeNull();
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
    });

    it('shows the reconnecting banner of a retro, which never speaks of cards kept locally', () => {
        given({ reconnecting: true });

        const banner = screen.getByRole('status', {
            name: (_name, element) =>
                element.getAttribute('data-variant') === 'banner',
        });

        expect(banner.textContent).toContain('Reconnecting…');
        expect(banner.textContent).toContain(
            'Live updates are paused. What you see may be out of date.',
        );
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });

    it('keeps only the title once the board has ended for this viewer', () => {
        const { container } = given({ status: 'deleted' });

        expect(
            screen.getByText('This retrospective has been deleted.'),
        ).toBeTruthy();
        expect(container.querySelector('ol[aria-label="Phases"]')).toBeNull();
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('gives a participant no facilitator bar and no facilitator menu', () => {
        given(
            {},
            retroSnapshot({
                viewer: { isFacilitator: false, participantId: 'bob' },
            }),
        );

        expect(
            screen.queryByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Facilitator menu' }),
        ).toBeNull();
    });

    describe('in the Icebreaker phase', () => {
        it('shows the game in place of the columns, in the one main of the shell', () => {
            const { container } = given({}, icebreakerSnapshot());

            const stage = screen.getByRole('region', {
                name: 'Icebreaker game',
            });

            expect(stage.getAttribute('data-room')).toBe('room-1');
            expect(stage.textContent).toContain('Ready to play?');
            expect(screen.getAllByRole('main')).toHaveLength(1);
            expect(
                container
                    .querySelector('[data-slot="retro-body"]')
                    ?.contains(stage),
            ).toBe(true);
            expect(
                container.querySelectorAll('[data-test^="retro-column-"]'),
            ).toHaveLength(0);
            expect(
                screen.queryByRole('button', { name: 'Add column' }),
            ).toBeNull();
        });

        it('keeps the chrome of the board: the Icebreaker step, the timer, the facilitator bar', () => {
            const { container } = given({}, icebreakerSnapshot());
            const header = container.querySelector('header') as HTMLElement;

            expect(
                header.querySelector('[aria-current="step"]')?.textContent,
            ).toContain('Icebreaker');
            expect(
                screen.getAllByRole('button', { name: 'Timer' }),
            ).toHaveLength(1);
            expect(
                header.contains(screen.getByRole('button', { name: 'Timer' })),
            ).toBe(true);
            expect(
                screen.getByRole('toolbar', { name: 'Facilitation tools' }),
            ).toBeTruthy();
        });

        it('leaves the room of the facilitator bar under the game', () => {
            const { container } = given({}, icebreakerSnapshot());

            expect(
                container.querySelector('[data-slot="retro-body"]')?.className,
            ).toContain('pb-32');
        });

        it('waits with a spinner until the game has loaded', () => {
            given({}, icebreakerSnapshot(null));

            expect(
                screen.getByRole('status', { name: 'Loading' }),
            ).toBeTruthy();
            expect(
                screen.queryByRole('region', { name: 'Icebreaker game' }),
            ).toBeNull();
        });
    });

    describe('in the ROTI phase', () => {
        const rotiSnapshot = () =>
            retroSnapshot({
                retro: { phase: 'roti' },
                roti: {
                    myScore: null,
                    respondents: 0,
                    voterIds: [],
                    canVote: true,
                },
            });

        it('shows the rating and who has voted in place of the columns, and ends the session from the bar', () => {
            const { container } = given({}, rotiSnapshot());

            expect(
                container.querySelector('[data-slot="retro-roti"]'),
            ).not.toBeNull();
            expect(
                screen.getByRole('group', { name: 'How was this retro?' }),
            ).toBeTruthy();
            expect(
                screen.getByRole('heading', { name: 'Who has voted' }),
            ).toBeTruthy();
            expect(
                container.querySelector('[data-slot="retro-columns"]'),
            ).toBeNull();
            expect(
                within(
                    screen.getByRole('toolbar', { name: 'Facilitation tools' }),
                ).getByRole('button', { name: 'End session' }),
            ).toBeTruthy();
            expect(screen.queryByText('Suggest group names')).toBeNull();
        });
    });
});
