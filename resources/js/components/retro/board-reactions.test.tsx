import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    BoardReactions,
    showsRetroReactions,
} from '@/components/retro/board-reactions';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

function channel() {
    return { whisper: vi.fn(), listen: vi.fn(), stopListening: vi.fn() };
}

describe('showsRetroReactions', () => {
    it('follows the setting and stops once the retro is completed', () => {
        expect(
            showsRetroReactions({ reactionsEnabled: true, phase: 'writing' }),
        ).toBe(true);
        expect(
            showsRetroReactions({ reactionsEnabled: false, phase: 'writing' }),
        ).toBe(false);
        expect(
            showsRetroReactions({ reactionsEnabled: true, phase: 'completed' }),
        ).toBe(false);
    });
});

describe('BoardReactions', () => {
    it('renders the Reactions toolbar once the presence channel is there', () => {
        renderInBoard(
            <BoardReactions />,
            boardContext(retroSnapshot(), { presence: channel() }),
        );

        expect(screen.getByRole('toolbar', { name: 'Reactions' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Send a reaction 🎉' }),
        ).toBeTruthy();
    });

    it('renders nothing without a channel or when reactions are off', () => {
        const withoutChannel = renderInBoard(
            <BoardReactions />,
            boardContext(),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
        withoutChannel.unmount();

        renderInBoard(
            <BoardReactions />,
            boardContext(
                retroSnapshot({ retro: { reactionsEnabled: false } }),
                {
                    presence: channel(),
                },
            ),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
    });
});
