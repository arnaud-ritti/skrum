import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Shapes, Users } from 'lucide-react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameKind } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GameLayout, type GameLayoutPanel } from './game-layout';
import { GamePicker } from './game-picker';
import { RoomProvider, type RoomContextValue } from './room-context';
import { hasPlayersOnLeft } from './room-sidebar';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function viewport(widestRem: number): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches:
                    Number(/min-width: (\d+)rem/.exec(query)?.[1]) <= widestRem,
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
}

const games = [
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'draw', label: 'Draw & Guess', available: true },
    { value: 'gif', label: 'Sprint in one GIF', available: true },
];

/** The columns of a room, as `GameRoom` lays them out for its host. */
function Room({ initial }: { initial: GameKind }) {
    const [game, setGame] = useState(initial);
    const ctx = {
        snapshot: { room: { id: 'room', game, isHost: true }, games },
        run: <T,>(mutation: Promise<T>) => mutation,
        refetch: async () => {
            setGame(mocks.request.mock.lastCall?.[1].game);
        },
    } as unknown as RoomContextValue;
    const choice: GameLayoutPanel = {
        id: 'choice',
        label: 'Choose a game',
        icon: Shapes,
        content: <GamePicker />,
    };
    const players: GameLayoutPanel = {
        id: 'players',
        label: 'Players',
        icon: Users,
        content: <p>the players</p>,
    };
    const stage = (
        <h2 id="game-stage-title" tabIndex={-1}>
            {game}
        </h2>
    );

    return (
        <RoomProvider value={ctx}>
            {hasPlayersOnLeft(game) ? (
                <GameLayout
                    variant="players"
                    left={players}
                    chooser={choice}
                    stage={stage}
                />
            ) : (
                <GameLayout left={choice} right={players} stage={stage} />
            )}
        </RoomProvider>
    );
}

function card(name: string | RegExp, container: HTMLElement = document.body) {
    return within(container).getByRole('radio', { name });
}

describe('GamePicker', () => {
    beforeEach(() => {
        mocks.request.mockReset();
        mocks.request.mockResolvedValue({});
        viewport(90);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('gives the focus to "Choose a game" when the cards column gives way to the players', async () => {
        renderWithProviders(<Room initial="hangman" />);

        const draw = card('Draw & Guess');

        draw.focus();
        fireEvent.click(draw);

        await waitFor(() =>
            expect(document.activeElement).toBe(
                within(
                    screen.getByRole('complementary', { name: 'Players' }),
                ).getByRole('button', { name: 'Choose a game' }),
            ),
        );
        expect(screen.queryByRole('radio')).toBeNull();
    });

    it('closes the sheet and gives the focus to the game in play when the cards column comes back', async () => {
        renderWithProviders(<Room initial="draw" />);

        const opener = screen.getByRole('button', { name: 'Choose a game' });

        opener.focus();
        fireEvent.click(opener);
        fireEvent.click(card('Hangman', screen.getByRole('dialog')));

        await waitFor(() =>
            expect(document.activeElement).toBe(
                card(
                    'Hangman',
                    screen.getByRole('complementary', {
                        name: 'Choose a game',
                    }),
                ),
            ),
        );
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            (document.activeElement as HTMLElement).getAttribute(
                'aria-checked',
            ),
        ).toBe('true');
    });

    it('keeps the sheet open and the focus on the card between two games that have the players on the left', async () => {
        renderWithProviders(<Room initial="draw" />);

        fireEvent.click(screen.getByRole('button', { name: 'Choose a game' }));

        const gif = card('Sprint in one GIF', screen.getByRole('dialog'));

        gif.focus();
        fireEvent.click(gif);

        await waitFor(() =>
            expect(gif.getAttribute('aria-checked')).toBe('true'),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(document.activeElement).toBe(gif);
    });
    it('shows the duration and players of every game, and never disables a card for the players count', () => {
        const ctx = {
            snapshot: {
                room: { id: 'room', game: 'hangman', isHost: true },
                games: [
                    { value: 'hangman', label: 'Hangman', available: true },
                    {
                        value: 'two_truths',
                        label: 'Two truths and a lie',
                        available: true,
                    },
                    { value: 'mood', label: 'Mood weather', available: true },
                    {
                        value: 'quick_question',
                        label: 'Quick question',
                        available: true,
                    },
                ],
                players: [{ id: 'p1', name: 'Alone', online: true }],
            },
            run: <T,>(mutation: Promise<T>) => mutation,
            refetch: async () => undefined,
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GamePicker />
            </RoomProvider>,
        );

        const hangman = card('Hangman');
        const twoTruths = card('Two truths and a lie');
        const mood = card('Mood weather');
        const quickQuestion = card('Quick question');

        expect(within(hangman).getByText('5–10 min')).toBeTruthy();
        expect(within(hangman).getByText('1-30')).toBeTruthy();
        expect(within(twoTruths).getByText('10 min')).toBeTruthy();
        expect(within(twoTruths).getByText('3-15')).toBeTruthy();
        expect(within(twoTruths).getByText('3 to 15 players')).toBeTruthy();
        expect(twoTruths.getAttribute('aria-disabled')).toBeNull();
        expect(within(mood).getByText('3 min · anonymous')).toBeTruthy();
        expect(within(quickQuestion).getByText('2 min / person')).toBeTruthy();
        expect(within(quickQuestion).getByText('1-12')).toBeTruthy();
    });

    it('says why Guess who? cannot be played in an anonymous retro', () => {
        const ctx = {
            snapshot: {
                room: { id: 'room', game: 'mood', isHost: true },
                games: [
                    { value: 'mood', label: 'Mood weather', available: true },
                    {
                        value: 'guess_who',
                        label: 'Guess who?',
                        available: false,
                    },
                ],
            },
            run: <T,>(mutation: Promise<T>) => mutation,
            refetch: async () => undefined,
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GamePicker />
            </RoomProvider>,
        );

        const guessWho = card(/Guess who\?/);

        expect(guessWho.getAttribute('aria-disabled')).toBe('true');
        expect(guessWho.textContent).toContain('Not in an anonymous retro');
    });
});
