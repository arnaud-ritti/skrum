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
    it('follows the setting alone, session end included', () => {
        expect(showsRetroReactions({ reactionsEnabled: true })).toBe(true);
        expect(showsRetroReactions({ reactionsEnabled: false })).toBe(false);
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

    it('gives an observer of the team no Reactions toolbar (P23-04)', () => {
        renderInBoard(
            <BoardReactions />,
            boardContext(
                retroSnapshot({
                    viewer: { isFacilitator: false, participantId: 'bob' },
                    viewerIsObserver: true,
                }),
                { presence: channel() },
            ),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
    });
});
