import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { useGifDraft } from './gif-draft';
import { GifYourPick } from './gif-your-pick';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function gif(id: string) {
    return { id, previewUrl: `/gifs/${id}/preview`, url: `/gifs/${id}/full` };
}

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'gif',
        revealedAt: null,
        answers: [],
        myAnswer: null,
        ...overrides,
    } as GameRound;
}

/** Stands for the picker of the stage: a search field and a way to pick. */
function Stage({ roundId }: { roundId: string }) {
    const { pick, pickerRef } = useGifDraft(roundId);

    return (
        <div ref={pickerRef}>
            <input type="search" aria-label="Search" />
            <button type="button" onClick={() => pick(gif('party'))}>
                pick party
            </button>
            <button type="button" onClick={() => pick(gif('coffee'))}>
                pick coffee
            </button>
        </div>
    );
}

function renderPick(current: GameRound) {
    const dispatch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'room' },
            me: { playerId: 'ada' },
            players: [
                { id: 'ada', name: 'Ada', avatarUrl: '', isGuest: false },
                { id: 'bob', name: 'Bob', avatarUrl: '', isGuest: false },
                { id: 'cy', name: 'Cy', avatarUrl: null, isGuest: true },
            ],
        },
        dispatch,
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <Stage roundId="round" />
            <GifYourPick round={current} />
        </RoomProvider>,
    );

    return { dispatch };
}

function state(): string | null | undefined {
    return document
        .querySelector('[data-slot="gif-your-pick"]')
        ?.getAttribute('data-state');
}

describe('GifYourPick', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('is empty until a GIF is picked on the stage, and sends nothing by itself', () => {
        renderPick(round());

        expect(state()).toBe('empty');
        expect(screen.getByRole('heading', { name: 'Your pick' })).toBeTruthy();
        expect(screen.getByText('No GIFs yet.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Send my GIF' }),
        ).toBeNull();

        fireEvent.click(screen.getByText('pick party'));

        expect(state()).toBe('draft');
        expect(screen.getByText('Draft')).toBeTruthy();
        expect(
            screen
                .getByRole('figure')
                .querySelector('img')
                ?.getAttribute('src'),
        ).toBe('/gifs/party/preview');
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('lets the player change the draft, then sends the last pick with "Send my GIF"', async () => {
        mocks.request.mockResolvedValue({
            myAnswer: { id: 'answer', gif: gif('coffee') },
        });
        const { dispatch } = renderPick(round());

        fireEvent.click(screen.getByText('pick party'));
        fireEvent.click(screen.getByText('pick coffee'));

        expect(
            screen
                .getByRole('figure')
                .querySelector('img')
                ?.getAttribute('src'),
        ).toBe('/gifs/coffee/preview');

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Send my GIF' }),
            );
        });

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(mocks.request.mock.calls[0][1]).toEqual({
            gif_id: 'coffee',
            caption: null,
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myAnswer: { id: 'answer', gif: gif('coffee') } },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'answer.changed',
            roundId: 'round',
            playerId: 'ada',
            answered: true,
        });
    });

    it('drops the draft with "Change" and gives the keyboard back to the search', () => {
        renderPick(round());

        fireEvent.click(screen.getByText('pick party'));
        fireEvent.click(screen.getByRole('button', { name: 'Change' }));

        expect(state()).toBe('empty');
        expect(document.activeElement).toBe(screen.getByLabelText('Search'));
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('shows the sent GIF with "Change GIF" and "Remove GIF", and a new pick as a draft over it', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderPick(
            round({
                myAnswer: { id: 'answer', gif: gif('party'), caption: null },
            }),
        );

        expect(state()).toBe('sent');
        expect(screen.getByText('Sent')).toBeTruthy();
        expect(screen.queryByText('No GIFs yet.')).toBeNull();

        fireEvent.click(screen.getByText('pick party'));

        expect(state()).toBe('sent');

        fireEvent.click(screen.getByRole('button', { name: 'Change GIF' }));

        expect(document.activeElement).toBe(screen.getByLabelText('Search'));

        fireEvent.click(screen.getByText('pick coffee'));

        expect(state()).toBe('draft');
        expect(
            screen.getByRole('button', { name: 'Send my GIF' }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Change' }));

        expect(state()).toBe('sent');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remove GIF' }));
        });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myAnswer: null },
        });
    });

    it('sends the caption with the GIF, trimmed, and counts its characters', async () => {
        mocks.request.mockResolvedValue({
            myAnswer: {
                id: 'answer',
                gif: gif('party'),
                caption: 'CI on Friday',
            },
        });
        renderPick(round());

        expect(screen.queryByLabelText('Caption')).toBeNull();

        fireEvent.click(screen.getByText('pick party'));

        const field = screen.getByLabelText('Caption');

        expect(field.getAttribute('placeholder')).toBe(
            'A short caption helps people vote.',
        );
        expect(field.getAttribute('maxlength')).toBe('60');

        fireEvent.change(field, { target: { value: ' CI on Friday ' } });

        expect(screen.getByText('14 / 60')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Send my GIF' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({
            gif_id: 'party',
            caption: 'CI on Friday',
        });
    });

    it('shows the sent caption, and saves a new one alone as a draft', async () => {
        mocks.request.mockResolvedValue({
            myAnswer: { id: 'answer', gif: gif('party'), caption: 'Later' },
        });
        const { dispatch } = renderPick(
            round({
                myAnswer: {
                    id: 'answer',
                    gif: gif('party'),
                    caption: 'CI on Friday',
                },
            }),
        );

        expect(state()).toBe('sent');
        expect(screen.getByRole('figure').textContent).toContain(
            'CI on Friday',
        );
        expect(
            (screen.getByLabelText('Caption') as HTMLInputElement).value,
        ).toBe('CI on Friday');
        expect(
            screen.queryByRole('button', { name: 'Save caption' }),
        ).toBeNull();

        fireEvent.change(screen.getByLabelText('Caption'), {
            target: { value: 'Later' },
        });

        expect(state()).toBe('draft');
        expect(screen.getByText('Draft')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Save caption' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({
            gif_id: 'party',
            caption: 'Later',
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: {
                myAnswer: { id: 'answer', gif: gif('party'), caption: 'Later' },
            },
        });
    });

    it('lists who has sent as hidden tiles, never the player', () => {
        renderPick(
            round({
                answers: [
                    { playerId: 'ada', answered: true },
                    { playerId: 'bob', answered: true },
                    { playerId: 'cy', answered: true },
                ],
            }),
        );

        const answers = screen.getByRole('list', { name: 'Answers' });

        expect(screen.getByText('Already sent · 2')).toBeTruthy();
        expect(within(answers).getAllByRole('listitem')).toHaveLength(2);
        expect(within(answers).getByText('Bob answered')).toBeTruthy();
        expect(within(answers).getByText('Cy answered')).toBeTruthy();
        expect(within(answers).queryByText('Ada answered')).toBeNull();
        expect(answers.querySelector('img')).toBeNull();
    });
});
