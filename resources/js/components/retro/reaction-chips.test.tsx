import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    optimisticReactions,
    ReactionChips,
} from '@/components/retro/reaction-chips';
import type { ReactionSummary } from '@/lib/retro/types';
import { boardContext, renderInBoard } from '@/test/retro-board';

const reactions: ReactionSummary[] = [
    { emoji: '👍', count: 1, mine: false, names: ['Bob Stone'] },
    { emoji: '🎉', count: 2, mine: true, names: [] },
];

function chips(canReact: boolean, onToggle = vi.fn()) {
    return {
        onToggle,
        ...renderInBoard(
            <ReactionChips
                reactions={reactions}
                canReact={canReact}
                onToggle={onToggle}
            />,
            boardContext(),
        ),
    };
}

describe('ReactionChips', () => {
    it('names each chip with its count and says which are mine', () => {
        const { onToggle } = chips(true);
        const thumb = screen.getByRole('button', { name: '👍, 1 reaction' });
        const party = screen.getByRole('button', { name: '🎉, 2 reactions' });

        expect(thumb.getAttribute('aria-pressed')).toBe('false');
        expect(party.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(thumb);

        expect(onToggle).toHaveBeenCalledWith('👍');
    });

    it('offers "Add a reaction" as a menu', () => {
        chips(true);

        expect(
            screen
                .getByRole('button', { name: 'Add a reaction' })
                .getAttribute('aria-haspopup'),
        ).toBe('menu');
    });

    it('disables the chips, keeps them readable and hides "Add a reaction" when reacting is closed', () => {
        chips(false);

        const thumb = screen.getByRole('button', {
            name: '👍, 1 reaction',
        }) as HTMLButtonElement;

        expect(thumb.disabled).toBe(true);
        expect(thumb.parentElement?.tabIndex).toBe(0);
        expect(screen.getByRole('group', { name: '👍, 1 reaction' })).toBe(
            thumb.parentElement,
        );
        expect(
            screen.getByRole('button', { name: '🎉, 2 reactions' })
                .parentElement?.tabIndex,
        ).toBe(-1);
        expect(
            screen.queryByRole('button', { name: 'Add a reaction' }),
        ).toBeNull();
    });
});

describe('optimisticReactions', () => {
    it('adds a first reaction, joins an existing one and takes mine back', () => {
        expect(optimisticReactions([], '👍', false)).toEqual([
            { emoji: '👍', count: 1, mine: true, names: [] },
        ]);
        expect(optimisticReactions(reactions, '👍', false)[0]).toMatchObject({
            count: 2,
            mine: true,
        });
        expect(optimisticReactions(reactions, '🎉', true)[1]).toMatchObject({
            count: 1,
            mine: false,
        });
    });

    it('drops a chip nobody is left on', () => {
        expect(
            optimisticReactions(
                [{ emoji: '👍', count: 1, mine: true, names: [] }],
                '👍',
                true,
            ),
        ).toEqual([]);
    });
});
