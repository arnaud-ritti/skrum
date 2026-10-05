import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retroRequest } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import { boardState } from '@/test/whiteboard-state';
import { BoardFacilitation } from './board-facilitation';

vi.mock('@/lib/retro/api', async (original) => ({
    ...(await original<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

vi.mock('@inertiajs/react', async (original) => ({
    ...(await original<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

afterEach(() => {
    vi.mocked(retroRequest).mockReset();
});

function answerLater(): () => Promise<void> {
    let answer: (value: unknown) => void = () => {};

    vi.mocked(retroRequest).mockImplementation(
        () => new Promise((resolve) => (answer = resolve)),
    );

    return async () => {
        await act(async () => answer({ timerEndsAt: null }));
    };
}

describe('BoardFacilitation', () => {
    it('extends the timer once on a double press', async () => {
        const answer = answerLater();

        renderWithProviders(
            <BoardFacilitation
                state={boardState({
                    board: {
                        timerEndsAt: new Date(
                            Date.now() + 60_000,
                        ).toISOString(),
                    },
                })}
            />,
        );

        const extend = screen.getByRole('button', { name: /\+2 min/ });

        fireEvent.click(extend);
        fireEvent.click(extend);

        expect(retroRequest).toHaveBeenCalledTimes(1);

        await answer();
    });

    it('locks the board once on a double press', async () => {
        const answer = answerLater();

        renderWithProviders(<BoardFacilitation state={boardState()} />);

        const lock = screen.getByRole('button', { name: 'Lock the board' });

        fireEvent.click(lock);
        fireEvent.click(lock);

        expect(retroRequest).toHaveBeenCalledTimes(1);

        await answer();
    });
});
