import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { QuestionBanner } from './question-banner';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'guess_who',
        revealedAt: null,
        question: 'What was your first job?',
        answers: [],
        myAnswer: null,
        ...overrides,
    } as GameRound;
}

function renderBanner(value: GameRound, isHost: boolean) {
    const dispatch = vi.fn();
    const ctx = {
        snapshot: { room: { id: 'room', isHost } },
        dispatch,
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;

    const view = renderWithProviders(
        <RoomProvider value={ctx}>
            <QuestionBanner round={value} hint="Answer the question." />
        </RoomProvider>,
    );
    const rerender = (next: GameRound) =>
        view.rerender(
            <RoomProvider value={ctx}>
                <QuestionBanner round={next} hint="Answer the question." />
            </RoomProvider>,
        );

    return { dispatch, rerender };
}

describe('QuestionBanner', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('shows the question and the hint to every player, without controls', () => {
        renderBanner(round(), false);

        expect(screen.getByText('What was your first job?')).toBeTruthy();
        expect(screen.getByText('Answer the question.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Shuffle question' }),
        ).toBeNull();
    });

    it('lets the host shuffle the question of any game that asks one', async () => {
        mocks.request.mockResolvedValue({ question: 'Your best holiday?' });
        const { dispatch } = renderBanner(round(), true);

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Shuffle question' }),
            );
        });

        expect(mocks.request.mock.calls[0][0].url).toContain('/question');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'question.changed',
            roundId: 'round',
            question: 'Your best holiday?',
        });
    });

    it('locks the question once someone answered', () => {
        renderBanner(
            round({ answers: [{ playerId: 'bob', answered: true }] }),
            true,
        );

        expect(
            screen.queryByRole('button', { name: 'Shuffle question' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Edit question' }),
        ).toBeNull();
    });
    it('closes the question editor once the first answer comes in', () => {
        const { rerender } = renderBanner(round(), true);

        fireEvent.click(screen.getByRole('button', { name: 'Edit question' }));

        expect(screen.getByRole('textbox', { name: 'Question' })).toBeTruthy();

        rerender(round({ answers: [{ playerId: 'bob', answered: true }] }));

        expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull();
        expect(screen.getByText('What was your first job?')).toBeTruthy();
    });

    it('keeps the question editor shut while a shuffle is on its way', () => {
        mocks.request.mockReturnValue(new Promise(() => undefined));
        renderBanner(round(), true);

        fireEvent.click(
            screen.getByRole('button', { name: 'Shuffle question' }),
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Edit question',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });
});
