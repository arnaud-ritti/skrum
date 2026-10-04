import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { ClueEditor } from './clue-editor';
import { RoomProvider, type RoomContextValue } from './room-context';

const api = vi.hoisted(() => ({ retroRequest: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

function renderEditor() {
    const run = vi.fn().mockResolvedValue({});
    const ctx = {
        snapshot: { room: { id: 'room' }, emojiData: null },
        run,
        dispatch: vi.fn(),
    } as unknown as RoomContextValue;

    const view = renderWithProviders(
        <RoomProvider value={ctx}>
            <ClueEditor
                round={{ id: 'round', clue: ['🍌', '🐒'] } as GameRound}
            />
        </RoomProvider>,
    );

    return { run, view };
}

describe('ClueEditor', () => {
    it('saves the clue once the pause is over', () => {
        const { run } = renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Remove 🐒' }));

        expect(run).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);

        expect(run).toHaveBeenCalledTimes(1);
    });

    it('still saves an edit made just before the editor goes away', () => {
        const { run, view } = renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Remove 🐒' }));
        view.unmount();

        expect(run).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(300);

        expect(run).toHaveBeenCalledTimes(1);
        expect(api.retroRequest).toHaveBeenCalledWith(expect.anything(), {
            clue: ['🍌'],
        });
    });
});
