import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useActionItemSelection } from '@/components/action-items/use-action-item-selection';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemFixture,
    actionItemViewerFixture,
} from '@/test/action-items';

const viewer = actionItemViewerFixture();

const mine = actionItemFixture({ id: 'a' });
const alsoMine = actionItemFixture({ id: 'b' });
const others = actionItemFixture({ id: 'c', isMine: false, retroId: null });

const filters: ActionItemFilters = {
    status: ['todo', 'doing'],
    priority: ['high'],
    due: null,
    source: null,
    assignee: null,
    team: 't1',
    item: null,
};

type Props = {
    rows: ActionItem[];
    total: number;
    filtersKey: string;
    pageKey: string;
};

function renderSelection(initial: Partial<Props> = {}) {
    return renderHook(
        (props: Props) => useActionItemSelection({ viewer, ...props }),
        {
            initialProps: {
                rows: [mine, alsoMine, others],
                total: 3,
                filtersKey: 'f1',
                pageKey: 'p1',
                ...initial,
            },
        },
    );
}

describe('useActionItemSelection', () => {
    it('selects only the rows the viewer may change', () => {
        const { result } = renderSelection();

        expect(result.current.selectable(mine)).toBe(true);
        expect(result.current.selectable(others)).toBe(false);
    });

    it('toggles a row and reads the header box', () => {
        const { result } = renderSelection();

        act(() => result.current.toggle('a'));

        expect(result.current.isSelected('a')).toBe(true);
        expect(result.current.head(['a', 'b'])).toBe('indeterminate');

        act(() => result.current.setMany(['a', 'b'], true));

        expect(result.current.head(['a', 'b'])).toBe(true);
        expect(result.current.count).toBe(2);

        act(() => result.current.clear());

        expect(result.current.head(['a', 'b'])).toBe(false);
    });

    it('drops a row that left the list', () => {
        const { result, rerender } = renderSelection();

        act(() => result.current.setMany(['a', 'b'], true));
        rerender({ rows: [mine], total: 1, filtersKey: 'f1', pageKey: 'p1' });

        expect([...result.current.selected]).toEqual(['a']);
    });

    it('offers all matching once the page is selected, and targets the filters', () => {
        const { result } = renderSelection({ total: 137 });

        expect(result.current.offer).toBeNull();

        act(() => result.current.setMany(['a', 'b'], true));

        expect(result.current.offer).toBe('offer');
        expect(result.current.target(filters)).toEqual({ ids: ['a', 'b'] });

        act(() => result.current.selectMatching());

        expect(result.current.matching).toEqual({ count: 137 });
        expect(result.current.count).toBe(137);
        expect(result.current.offer).toBeNull();
        expect(result.current.target(filters)).toEqual({
            filters: { priority: 'high', team: 't1' },
            count: 137,
        });
    });

    it('refuses the offer above the cap', () => {
        const { result } = renderSelection({ total: 501 });

        act(() => result.current.setMany(['a', 'b'], true));

        expect(result.current.offer).toBe('too-many');
    });

    it('leaves all matching when a row is unticked, keeping the other rows', () => {
        const { result } = renderSelection({ total: 137 });

        act(() => result.current.setMany(['a', 'b'], true));
        act(() => result.current.selectMatching());
        act(() => result.current.toggle('a'));

        expect(result.current.matching).toBeNull();
        expect([...result.current.selected]).toEqual(['b']);
    });

    it('keeps all matching over a page change and clears it on a filter change', () => {
        const { result, rerender } = renderSelection({ total: 137 });

        act(() => result.current.setMany(['a', 'b'], true));
        act(() => result.current.selectMatching());
        rerender({
            rows: [alsoMine],
            total: 137,
            filtersKey: 'f1',
            pageKey: 'p2',
        });

        expect(result.current.matching).toEqual({ count: 137 });
        expect(result.current.isSelected('b')).toBe(true);

        rerender({
            rows: [alsoMine],
            total: 12,
            filtersKey: 'f2',
            pageKey: 'p2',
        });

        expect(result.current.matching).toBeNull();
        expect(result.current.count).toBe(0);
    });

    it('clears the rows on a page change', () => {
        const { result, rerender } = renderSelection();

        act(() => result.current.toggle('a'));
        rerender({
            rows: [mine, alsoMine],
            total: 3,
            filtersKey: 'f1',
            pageKey: 'p2',
        });

        expect(result.current.count).toBe(0);
    });

    it('counts the reloaded total in all matching mode', () => {
        const { result, rerender } = renderSelection({ total: 137 });

        act(() => result.current.setMany(['a', 'b'], true));
        act(() => result.current.selectMatching());
        rerender({
            rows: [mine, alsoMine],
            total: 140,
            filtersKey: 'f1',
            pageKey: 'p1',
        });

        expect(result.current.target(filters)).toEqual({
            filters: { priority: 'high', team: 't1' },
            count: 140,
        });
    });
});
