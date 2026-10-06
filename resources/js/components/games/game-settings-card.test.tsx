import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    GameKind,
    GameRoomSettingsInfo,
    GameRound,
} from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GameSettingsCard } from './game-settings-card';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(null);
});

type Setup = {
    game: GameKind;
    canManage?: boolean;
    isIcebreaker?: boolean;
    access?: 'team' | 'link';
    settings?: Partial<GameRoomSettingsInfo>;
    round?: Partial<GameRound> | null;
    run?: RoomContextValue['run'];
};

function renderCard({
    game,
    canManage = true,
    isIcebreaker = false,
    access = 'link',
    settings = {},
    round = null,
    run = <T,>(mutation: Promise<T>) => mutation,
}: Setup) {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game,
                canManage,
                isIcebreaker,
                access,
                settings: {
                    wordThemes: [],
                    turnSeconds: null,
                    autoHints: false,
                    takesTurns: true,
                    roundsPerGame: null,
                    gifVotes: 2,
                    gifAuthorsHidden: true,
                    ...settings,
                },
            },
            me: { playerId: 'ada' },
            players: [],
            round,
        },
        run,
        refetch,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <GameSettingsCard />
        </RoomProvider>,
    );

    return { refetch };
}

function rowLabels(): string[] {
    const card = document.querySelector<HTMLElement>(
        '[data-slot="game-settings-card"]',
    );

    return [
        ...(card?.querySelectorAll('[data-slot="setting-label"]') ?? []),
    ].map((label) => label.textContent ?? '');
}

describe('GameSettingsCard', () => {
    it.each<[GameKind, string, string[]]>([
        [
            'hangman',
            'Game settings',
            [
                'Word theme',
                'Time per turn',
                'Take turns',
                'Rounds per game',
                'Allow guests without an account',
            ],
        ],
        [
            'draw',
            'Round settings',
            ['Word list', 'Time per turn', 'Auto hints', 'Rounds per game'],
        ],
        [
            'decoded',
            'Game settings',
            ['Categories', 'Time per round', 'Auto hints', 'Rounds per game'],
        ],
        [
            'gif',
            'Game settings',
            ['Votes', 'Hide authors until the votes close', 'Rounds per game'],
        ],
        ['two_truths', 'Game settings', ['Time per turn', 'Rounds per game']],
        ['guess_who', 'Game settings', ['Rounds per game']],
        [
            'quick_question',
            'Game settings',
            ['Time per person', 'Rounds per game'],
        ],
    ])('shows the rows of %s', (game, title, rows) => {
        renderCard({ game });

        expect(screen.getByText(title)).toBeTruthy();
        expect(rowLabels()).toEqual(rows);
    });

    it('says the answers of Mood weather are anonymous, without a row', () => {
        renderCard({ game: 'mood' });

        expect(rowLabels()).toEqual([]);
        expect(screen.getByText('Answers are anonymous.')).toBeTruthy();
    });

    it('leaves the guests of an icebreaker to the retro', () => {
        renderCard({ game: 'hangman', isIcebreaker: true });

        expect(rowLabels()).not.toContain('Allow guests without an account');
    });

    it('is not shown to who does not manage the room', () => {
        renderCard({ game: 'hangman', canManage: false });

        expect(
            document.querySelector('[data-slot="game-settings-card"]'),
        ).toBeNull();
    });

    it('saves a change at once with the body of that setting', async () => {
        const { refetch } = renderCard({ game: 'draw' });

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Time per turn' }),
        );
        await userEvent.click(
            within(screen.getByRole('listbox')).getByRole('option', {
                name: '80 s',
            }),
        );

        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(mocks.request.mock.calls[0][1]).toEqual({ turn_seconds: 80 });

        await userEvent.click(
            screen.getByRole('switch', { name: 'Auto hints' }),
        );

        expect(mocks.request.mock.calls[1][1]).toEqual({ auto_hints: true });
    });

    it('sends every word when the theme goes back to all words', async () => {
        renderCard({ game: 'hangman', settings: { wordThemes: ['food'] } });

        const theme = screen.getByRole('combobox', { name: 'Word theme' });

        expect(theme.textContent).toBe('Food');

        await userEvent.click(theme);
        await userEvent.click(
            within(screen.getByRole('listbox')).getByRole('option', {
                name: 'All words',
            }),
        );

        expect(mocks.request.mock.calls[0][1]).toEqual({ word_themes: [] });
    });

    it('shows the number of themes chosen through Decoded on the word theme of another game', () => {
        renderCard({
            game: 'hangman',
            settings: { wordThemes: ['work', 'food'] },
        });

        expect(
            screen.getByRole('combobox', { name: 'Word theme' }).textContent,
        ).toBe('2 chosen');
    });

    it('shows all words before the answer when chosen over several themes', async () => {
        const run = vi.fn(
            () => new Promise<undefined>(() => undefined),
        ) as unknown as RoomContextValue['run'];

        renderCard({
            game: 'hangman',
            settings: { wordThemes: ['work', 'food'] },
            run,
        });

        const theme = screen.getByRole('combobox', { name: 'Word theme' });

        await userEvent.click(theme);
        await userEvent.click(
            within(screen.getByRole('listbox')).getByRole('option', {
                name: 'All words',
            }),
        );

        expect(theme.textContent).toBe('All words');
    });

    it('chooses the categories of Decoded in a popover', async () => {
        renderCard({
            game: 'decoded',
            settings: { wordThemes: ['work', 'food'] },
        });

        const trigger = screen.getByRole('button', { name: 'Categories' });

        expect(trigger.textContent).toContain('2 chosen');

        await userEvent.click(trigger);
        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Nature & animals' }),
        );

        expect(mocks.request.mock.calls[0][1]).toEqual({
            word_themes: ['work', 'food', 'nature'],
        });
    });

    it('shows the new value before the answer, and the room value again when it fails', async () => {
        let fail: () => void = () => undefined;
        const run = vi.fn(
            () =>
                new Promise<undefined>((resolve) => {
                    fail = () => resolve(undefined);
                }),
        ) as unknown as RoomContextValue['run'];

        renderCard({ game: 'gif', run });

        const hidden = screen.getByRole('switch', {
            name: 'Hide authors until the votes close',
        });

        expect(hidden.getAttribute('aria-checked')).toBe('true');

        await userEvent.click(hidden);

        expect(hidden.getAttribute('aria-checked')).toBe('false');

        fail();

        await waitFor(() =>
            expect(hidden.getAttribute('aria-checked')).toBe('true'),
        );
    });

    it('asks before the guests lose their access, then changes the access of the room', async () => {
        renderCard({ game: 'hangman', access: 'link' });

        await userEvent.click(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }),
        );

        const dialog = await screen.findByRole('alertdialog');

        expect(
            within(dialog).getByText('Guests in this room lose access.'),
        ).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Turn off' }),
        );

        await waitFor(() =>
            expect(mocks.request.mock.calls[0][1]).toEqual({ access: 'team' }),
        );
    });

    it('lets guests in at once', async () => {
        renderCard({ game: 'hangman', access: 'team' });

        await userEvent.click(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(mocks.request.mock.calls[0][1]).toEqual({ access: 'link' });
    });

    it('notes during a round that the changes wait for the next one', () => {
        renderCard({
            game: 'hangman',
            round: { id: 'round', game: 'hangman' },
        });

        expect(
            screen.getByText('Changes apply from the next round.'),
        ).toBeTruthy();
    });

    it('offers endless rounds or a number of rounds', async () => {
        renderCard({ game: 'guess_who', settings: { roundsPerGame: 5 } });

        const rounds = screen.getByRole('combobox', {
            name: 'Rounds per game',
        });

        expect(rounds.textContent).toBe('5');

        await userEvent.click(rounds);

        expect(
            within(screen.getByRole('listbox'))
                .getAllByRole('option')
                .map((option) => option.textContent),
        ).toEqual(['Endless', '3', '5', '6', '8', '10']);

        await userEvent.click(screen.getByRole('option', { name: 'Endless' }));

        expect(mocks.request.mock.calls[0][1]).toEqual({
            rounds_per_game: null,
        });
    });
});
