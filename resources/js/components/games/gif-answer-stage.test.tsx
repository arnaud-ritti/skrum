import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GifAnswerStage } from './gif-answer-stage';
import { GifYourPick } from './gif-your-pick';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'gif',
        revealedAt: null,
        gifProvider: 'giphy',
        answers: [],
        myAnswer: null,
        ...overrides,
    } as GameRound;
}

function wide(matches: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches,
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
}

function renderStage(
    current: GameRound,
    { isHost = false, column = false } = {},
) {
    const ctx = {
        snapshot: {
            room: { id: 'room', isHost },
            me: { playerId: 'ada' },
            players: [],
        },
        dispatch: vi.fn(),
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <GifAnswerStage round={current} />
            {column && <GifYourPick round={current} />}
        </RoomProvider>,
    );
}

async function settle() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
    });
}

describe('GifAnswerStage', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.request.mockReset();
        mocks.request.mockResolvedValue({
            gifs: [
                {
                    id: 'party',
                    previewUrl: '/gifs/party/preview',
                    width: 200,
                    height: 150,
                },
                {
                    id: 'coffee',
                    previewUrl: '/gifs/coffee/preview',
                    width: 200,
                    height: 150,
                },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('has the picker open on the stage, not in a dialog, and searches at once', async () => {
        wide(true);
        renderStage(round(), { column: true });
        await settle();

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            screen
                .getByRole('group', { name: 'Choose a GIF' })
                .getAttribute('data-inline'),
        ).toBe('true');
        expect(screen.getAllByRole('option')).toHaveLength(2);
        expect(screen.getByText('Powered by GIPHY')).toBeTruthy();
        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByRole('button', { name: 'Choose a GIF' }),
        ).toBeNull();
    });

    it('makes a pick a draft of "Your pick" in the right column, ticked in the picker, and sends nothing', async () => {
        wide(true);
        renderStage(round(), { column: true });
        await settle();

        fireEvent.click(screen.getAllByRole('option')[1]);

        expect(
            screen.getAllByRole('option')[1].getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.getByText('Draft')).toBeTruthy();
        expect(
            screen.getAllByRole('heading', { name: 'Your pick' }),
        ).toHaveLength(1);
        expect(
            screen
                .getByRole('figure')
                .querySelector('img')
                ?.getAttribute('src'),
        ).toBe('/gifs/coffee/preview');
        expect(mocks.request).toHaveBeenCalledTimes(1);
    });

    it('holds "Your pick" under the picker where the right column is a sheet', async () => {
        wide(false);
        renderStage(round());
        await settle();

        expect(
            screen.getByRole('heading', { level: 3, name: 'Your pick' }),
        ).toBeTruthy();

        fireEvent.click(screen.getAllByRole('option')[0]);

        expect(
            screen.getByRole('button', { name: 'Send my GIF' }),
        ).toBeTruthy();
    });

    it('ticks the sent GIF in the picker', async () => {
        wide(true);
        renderStage(
            round({
                myAnswer: {
                    id: 'answer',
                    gif: {
                        id: 'party',
                        previewUrl: '/gifs/party/preview',
                        url: '',
                    },
                    caption: null,
                },
            }),
        );
        await settle();

        expect(
            screen.getAllByRole('option')[0].getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.queryByRole('heading', { name: 'Your pick' })).toBeNull();
    });

    it('tells the host beside "Reveal the GIFs" that their draft is not sent', async () => {
        wide(true);
        renderStage(round(), { isHost: true, column: true });
        await settle();

        const hint = 'Your GIF is not sent yet: send it before the reveal.';

        expect(screen.queryByText(hint)).toBeNull();

        fireEvent.click(screen.getAllByRole('option')[1]);

        expect(screen.getByText(hint)).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Reveal the GIFs' })
                .getAttribute('aria-describedby'),
        ).toBe(screen.getByText(hint).id);
    });

    it('keeps "Reveal the GIFs" for the host alone and says so when GIFs are off', async () => {
        wide(true);
        const { unmount } = renderStage(round({ gifProvider: null }), {
            isHost: true,
        });
        await settle();

        expect(
            screen.getByRole('button', { name: 'Reveal the GIFs' }),
        ).toBeTruthy();
        expect(screen.getByText('GIFs are disabled')).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        unmount();
        renderStage(round());
        await settle();

        expect(
            screen.queryByRole('button', { name: 'Reveal the GIFs' }),
        ).toBeNull();
    });
});
