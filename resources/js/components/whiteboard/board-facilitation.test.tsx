import { act, fireEvent, screen, within } from '@testing-library/react';
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
    it('floats the timer, lock and bring-everyone controls on the board for the facilitator', () => {
        renderWithProviders(<BoardFacilitation state={boardState()} />);

        const pill = document.querySelector<HTMLElement>(
            '[data-slot="board-facilitation"]',
        );
        const tools = within(pill as HTMLElement).getByRole('toolbar', {
            name: 'Facilitation tools',
        });

        for (const place of ['absolute', 'top-3', 'right-3', 'z-10']) {
            expect(pill?.className.split(' ')).toContain(place);
        }

        expect(
            within(tools).getByRole('button', { name: 'Timer' }),
        ).toBeTruthy();

        for (const name of ['Lock the board', 'Bring everyone to me']) {
            expect(
                within(tools).getByRole('button', { name }).textContent,
            ).toBe(name);
        }
    });

    it('keeps the names of the controls on a narrow board, where they are icons', () => {
        renderWithProviders(<BoardFacilitation state={boardState()} compact />);

        for (const name of ['Lock the board', 'Bring everyone to me']) {
            expect(screen.getByRole('button', { name }).textContent).toBe('');
        }
    });

    it('says on the pill that the board is locked and that everyone follows', () => {
        renderWithProviders(
            <BoardFacilitation
                state={boardState({
                    board: { locked: true, followEnabled: true },
                })}
            />,
        );

        for (const name of ['Unlock the board', 'Bring everyone to me']) {
            expect(
                screen
                    .getByRole('button', { name })
                    .getAttribute('aria-pressed'),
            ).toBe('true');
        }
    });

    it('shows no pill to a member who does not facilitate', () => {
        renderWithProviders(
            <BoardFacilitation
                state={boardState({ me: { isFacilitator: false } })}
            />,
        );

        expect(
            document.querySelector('[data-slot="board-facilitation"]'),
        ).toBeNull();
        expect(screen.queryByRole('toolbar')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

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
