import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { MoodWeatherBoard, MoodWeatherResult } from './mood-weather-board';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'mood',
        leaderPlayerId: null,
        revealedAt: null,
        turnOrder: [],
        turnPlayerId: null,
        turnEndsAt: null,
        answers: [{ playerId: 'bob', answered: true }],
        myChoice: null,
        threshold: 3,
        ...overrides,
    } as GameRound;
}

function renderWithRoom(ui: React.ReactElement, { isHost = false } = {}) {
    const dispatch = vi.fn();
    const refetch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'room', game: 'mood', isHost },
            me: { playerId: 'ada' },
            players: [],
        },
        online: [],
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
        refetch,
    } as unknown as RoomContextValue;

    renderWithProviders(<RoomProvider value={ctx}>{ui}</RoomProvider>);

    return { dispatch, refetch };
}

describe('MoodWeatherBoard', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('asks for a weather among five, anonymously, with nothing picked', () => {
        renderWithRoom(<MoodWeatherBoard round={round()} />);

        expect(
            screen.getByText("What's the weather of your mood?"),
        ).toBeTruthy();
        expect(screen.getByText('Answers are anonymous.')).toBeTruthy();

        const group = screen.getByRole('radiogroup', {
            name: "What's the weather of your mood?",
        });
        const weathers = within(group).getAllByRole('radio');

        expect(weathers.map((weather) => weather.textContent)).toEqual([
            'Sunny',
            'Some clouds',
            'Cloudy',
            'Rainy',
            'Stormy',
        ]);
        expect(
            weathers.every(
                (weather) => weather.getAttribute('aria-checked') === 'false',
            ),
        ).toBe(true);
        expect(screen.getByText('1 answered')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Show the weather' }),
        ).toBeNull();
    });

    it('sends a pick at once and counts the viewer among those who answered', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(
            <MoodWeatherBoard round={round()} />,
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Rainy' }));
        });

        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: 'rainy' },
        });
        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({ choice: 'rainy' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'answer.changed',
            roundId: 'round',
            playerId: 'ada',
            answered: true,
        });
    });

    it('rings the chosen weather and withdraws it on a second click', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(
            <MoodWeatherBoard round={round({ myChoice: 'sunny' })} />,
        );
        const sunny = screen.getByRole('radio', { name: 'Sunny' });

        expect(sunny.getAttribute('aria-checked')).toBe('true');

        await act(async () => {
            fireEvent.click(sunny);
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'answer.changed',
            roundId: 'round',
            playerId: 'ada',
            answered: false,
        });
    });

    it('lets the host show the weather, which ends the round', async () => {
        const ended = { roundId: 'round', outcome: 'revealed', points: [] };
        mocks.request.mockResolvedValue({ ended });
        const { dispatch, refetch } = renderWithRoom(
            <MoodWeatherBoard round={round()} />,
            { isHost: true },
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Show the weather' }),
            );
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('post');
        expect(dispatch).toHaveBeenCalledWith({ type: 'round.ended', ended });
        expect(refetch).toHaveBeenCalled();
    });

    it('stacks the five weathers on two rows on a phone, with large targets', () => {
        renderWithRoom(<MoodWeatherBoard round={round()} />);

        expect(screen.getByRole('radiogroup').className).toContain(
            'grid-cols-3',
        );
        expect(
            screen.getByRole('radio', { name: 'Sunny' }).className,
        ).toContain('min-h-11');
    });
});

describe('MoodWeatherResult', () => {
    it('shows a bar per weather in the order of the server', () => {
        renderWithRoom(
            <MoodWeatherResult
                answered={3}
                weather={[
                    { weather: 'sunny', count: 2 },
                    { weather: 'partly_cloudy', count: 0 },
                    { weather: 'cloudy', count: 0 },
                    { weather: 'rainy', count: 1 },
                    { weather: 'stormy', count: 0 },
                ]}
            />,
        );
        const bars = screen.getAllByRole('progressbar');

        expect(bars).toHaveLength(5);
        expect(bars[0].getAttribute('aria-valuetext')).toBe('2');
        expect(bars[3].getAttribute('aria-valuetext')).toBe('1');
        expect(screen.getByText('Sunny')).toBeTruthy();
        expect(screen.getByText('3 answered')).toBeTruthy();
    });

    it('keeps the weather back under the threshold', () => {
        renderWithRoom(<MoodWeatherResult answered={2} weather={null} />);

        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(
            screen.getByText(
                'Not enough answers to show the weather (3 needed).',
            ),
        ).toBeTruthy();
    });

    it('says the threshold the server sends', () => {
        renderWithRoom(
            <MoodWeatherResult answered={2} weather={null} threshold={4} />,
        );

        expect(
            screen.getByText(
                'Not enough answers to show the weather (4 needed).',
            ),
        ).toBeTruthy();
    });
});
