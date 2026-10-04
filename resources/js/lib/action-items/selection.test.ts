import { describe, expect, it } from 'vitest';
import {
    headState,
    keepListed,
    leaveMatching,
    MatchingCap,
    matchingOffer,
    setSelected,
    toggleSelected,
} from '@/lib/action-items/selection';

describe('selection', () => {
    it('toggles one id', () => {
        const once = toggleSelected(new Set(), 'a');

        expect([...once]).toEqual(['a']);
        expect([...toggleSelected(once, 'a')]).toEqual([]);
    });

    it('selects and clears several ids', () => {
        const all = setSelected(new Set(['a']), ['b', 'c'], true);

        expect([...all].sort()).toEqual(['a', 'b', 'c']);
        expect([...setSelected(all, ['a', 'b'], false)]).toEqual(['c']);
    });

    it('drops the ids that left the list and keeps the same set otherwise', () => {
        const selection = new Set(['a', 'b']);

        expect([...keepListed(selection, ['b', 'c'])]).toEqual(['b']);
        expect(keepListed(selection, ['a', 'b', 'c'])).toBe(selection);
    });

    it('reads the header box', () => {
        expect(headState(new Set(), ['a', 'b'])).toBe(false);
        expect(headState(new Set(['a']), ['a', 'b'])).toBe('indeterminate');
        expect(headState(new Set(['a', 'b']), ['a', 'b'])).toBe(true);
        expect(headState(new Set(['a']), [])).toBe(false);
    });

    it('offers every matching item once the whole page is selected and more items match', () => {
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 2, 137)).toBe(
            'offer',
        );
        expect(matchingOffer(new Set(['a']), ['a', 'b'], 2, 137)).toBeNull();
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 2, 2)).toBeNull();
        expect(
            matchingOffer(new Set(['a', 'b']), ['a', 'b'], 2, MatchingCap + 1),
        ).toBe('too-many');
    });

    it('offers nothing when the rows that cannot be selected make up the rest of the list', () => {
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 3, 3)).toBeNull();
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 3, 4)).toBe(
            'offer',
        );
    });

    it('leaves "all matching" for the page without the unticked row', () => {
        expect([...leaveMatching(['a', 'b', 'c'], 'b')]).toEqual(['a', 'c']);
    });
});
