import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    activeFilterCount,
    filterQuery,
    filterStorageKey,
    landingQuery,
    readStoredFilters,
    storedGrouping,
    useActionItemFilters,
} from '@/components/action-items/use-action-item-filters';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return { ...original, router: { get: mocks.get } };
});

const workspace = { id: 'ws-1', slug: 'nordlys' };
const defaults: ActionItemFilters = {
    status: 'open',
    assignee: null,
    team: null,
    item: null,
};

function stored(): unknown {
    return JSON.parse(
        window.localStorage.getItem(filterStorageKey(workspace.id)) ?? 'null',
    );
}

function lastVisit(): { url: string; options: Record<string, unknown> } {
    const call = mocks.get.mock.calls.at(-1);

    return { url: call?.[0], options: call?.[2] };
}

function mount(
    filters: ActionItemFilters = defaults,
    currentTeamId: string | null = 'team-1',
) {
    return renderHook(() =>
        useActionItemFilters({
            workspace,
            filters,
            currentTeamId,
            teamIds: ['team-1', 'team-2'],
        }),
    );
}

beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/w/nordlys/action-items');
    mocks.get.mockReset();
});

afterEach(() => {
    window.history.replaceState({}, '', '/');
});

describe('filterQuery', () => {
    it('leaves the default status out of the query', () => {
        expect(filterQuery(defaults)).toEqual({});
        expect(
            filterQuery({ status: 'overdue', assignee: 'me', team: 'team-1' }),
        ).toEqual({ status: 'overdue', assignee: 'me', team: 'team-1' });
    });
});

describe('landingQuery', () => {
    it('opens on the current team when nothing is stored', () => {
        expect(landingQuery(null, 'team-1', ['team-1'])).toEqual({
            team: 'team-1',
        });
    });

    it('stays on every team without a current team the viewer can see', () => {
        expect(landingQuery(null, null, ['team-1'])).toBeNull();
        expect(landingQuery(null, 'team-9', ['team-1'])).toBeNull();
    });

    it('lets the stored filters win, an empty entry included', () => {
        expect(landingQuery({ status: 'all' }, 'team-1', ['team-1'])).toEqual({
            status: 'all',
        });
        expect(landingQuery({}, 'team-1', ['team-1'])).toBeNull();
    });

    it('never sends the grouping to the server', () => {
        expect(
            landingQuery({ team: 'team-2', group: 'team' }, 'team-1', [
                'team-1',
            ]),
        ).toEqual({ team: 'team-2' });
        expect(
            landingQuery({ group: 'team' }, 'team-1', ['team-1']),
        ).toBeNull();
    });
});

describe('stored entry', () => {
    it('reads the grouping and falls back to none', () => {
        expect(storedGrouping({ group: 'assignee' })).toBe('assignee');
        expect(storedGrouping({ group: 'status' })).toBe('none');
        expect(storedGrouping(null)).toBe('none');
    });

    it('ignores an entry that is not an object of strings', () => {
        window.localStorage.setItem(filterStorageKey('ws-1'), '{"team":3}');
        expect(readStoredFilters('ws-1')).toEqual({});

        window.localStorage.setItem(filterStorageKey('ws-1'), 'not json');
        expect(readStoredFilters('ws-1')).toBeNull();
    });
});

describe('activeFilterCount', () => {
    it('counts the facets that narrow the list', () => {
        expect(activeFilterCount(defaults)).toBe(0);
        expect(
            activeFilterCount({
                status: 'all',
                assignee: 'me',
                team: 'team-1',
                item: null,
            }),
        ).toBe(3);
    });
});

describe('useActionItemFilters', () => {
    it('lands on the current team on a first visit', () => {
        mount();

        expect(mocks.get).toHaveBeenCalledTimes(1);
        expect(lastVisit().url).toContain('team=team-1');
        expect(lastVisit().options).toMatchObject({ replace: true });
        expect(stored()).toBeNull();
    });

    it('restores the stored filters instead of the current team', () => {
        window.localStorage.setItem(
            filterStorageKey(workspace.id),
            JSON.stringify({ status: 'all', team: 'team-2', group: 'team' }),
        );

        const { result } = mount();

        expect(lastVisit().url).toContain('status=all');
        expect(lastVisit().url).toContain('team=team-2');
        expect(lastVisit().url).not.toContain('group');
        expect(result.current.grouping).toBe('team');
    });

    it('leaves a visit with a query alone', () => {
        window.history.replaceState(
            {},
            '',
            '/w/nordlys/action-items?status=all',
        );

        mount({ ...defaults, status: 'all' });

        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('stores what it applies and drops the item of a deep link', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?item=x');

        const { result } = mount({ ...defaults, team: 'team-1', item: 'x' });

        act(() => result.current.apply({ team: null, status: 'completed' }));

        expect(stored()).toEqual({ status: 'completed' });
        expect(lastVisit().url).toContain('status=completed');
        expect(lastVisit().url).not.toContain('item=');
        expect(lastVisit().url).not.toContain('team=');
    });

    it('keeps the grouping in the same entry as the filters', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const { result } = mount({ ...defaults, team: 'team-1' });

        act(() => result.current.setGrouping('assignee'));

        expect(result.current.grouping).toBe('assignee');
        expect(stored()).toEqual({ team: 'team-1', group: 'assignee' });

        act(() => result.current.apply({ assignee: 'me' }));

        expect(stored()).toEqual({
            team: 'team-1',
            assignee: 'me',
            group: 'assignee',
        });

        act(() => result.current.setGrouping('none'));

        expect(stored()).toEqual({ team: 'team-1' });
    });

    it('resets to the bare page and forgets the stored entry', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');
        window.localStorage.setItem(
            filterStorageKey(workspace.id),
            JSON.stringify({ team: 'team-1', group: 'team' }),
        );

        const { result } = mount({ ...defaults, team: 'team-1' });

        act(() => result.current.reset());

        expect(stored()).toBeNull();
        expect(result.current.grouping).toBe('none');
        expect(lastVisit().url).not.toContain('?');
    });

    it('is loading between the start and the end of a filter visit', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const { result } = mount({ ...defaults, team: 'team-1' });

        act(() => result.current.apply({ status: 'all' }));

        const { onStart, onFinish } = lastVisit().options as {
            onStart: () => void;
            onFinish: () => void;
        };

        act(() => onStart());
        expect(result.current.loading).toBe(true);

        act(() => onFinish());
        expect(result.current.loading).toBe(false);
    });
});
