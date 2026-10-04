import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    activeFilterCount,
    DefaultStatuses,
    filterQuery,
    isDefaultStatus,
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
const AllStatuses: ActionItemFilters['status'] = ['todo', 'doing', 'completed'];

const defaults: ActionItemFilters = {
    status: ['todo', 'doing'],
    priority: [],
    due: null,
    source: null,
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
            filterQuery({
                ...defaults,
                due: 'overdue',
                assignee: 'me',
                team: 'team-1',
            }),
        ).toEqual({ due: 'overdue', assignee: 'me', team: 'team-1' });
    });

    it('writes the default statuses as no query, and lists otherwise', () => {
        expect(
            filterQuery({
                status: ['todo', 'doing'],
                priority: [],
                due: null,
                source: null,
                assignee: null,
                team: null,
            }),
        ).toEqual({});
        expect(
            filterQuery({
                status: ['todo', 'doing', 'completed'],
                priority: ['high', 'low'],
                due: 'overdue',
                source: 'outside',
                assignee: null,
                team: null,
            }),
        ).toEqual({
            status: 'todo,doing,completed',
            priority: 'high,low',
            due: 'overdue',
            source: 'outside',
        });
    });

    it('writes the statuses and the priorities in their canonical order', () => {
        expect(
            filterQuery({
                ...defaults,
                status: ['completed', 'todo'],
                priority: ['low', 'high'],
            }),
        ).toEqual({ status: 'todo,completed', priority: 'high,low' });
        expect(filterQuery({ ...defaults, status: ['doing', 'todo'] })).toEqual(
            {},
        );
    });
});

describe('isDefaultStatus', () => {
    it('is the default for to do and in progress, in any order', () => {
        expect(isDefaultStatus(['doing', 'todo'])).toBe(true);
        expect(isDefaultStatus(DefaultStatuses)).toBe(true);
        expect(isDefaultStatus(['todo'])).toBe(false);
        expect(isDefaultStatus(AllStatuses)).toBe(false);
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

    it('adds the current team to stored filters that chose no team', () => {
        expect(landingQuery({ status: 'all' }, 'team-1', ['team-1'])).toEqual({
            status: 'all',
            team: 'team-1',
        });
        expect(landingQuery({}, 'team-1', ['team-1'])).toEqual({
            team: 'team-1',
        });
        expect(landingQuery({ status: 'all' }, null, ['team-1'])).toEqual({
            status: 'all',
        });
    });

    it('lets the stored team win over the current team', () => {
        expect(
            landingQuery({ team: 'team-2' }, 'team-1', ['team-1', 'team-2']),
        ).toEqual({ team: 'team-2' });
    });

    it('does not remember every team: an entry that says so follows the current team', () => {
        expect(
            landingQuery({ team: '', status: 'all' }, 'team-1', ['team-1']),
        ).toEqual({ status: 'all', team: 'team-1' });
        expect(landingQuery({ team: '' }, 'team-1', ['team-1'])).toEqual({
            team: 'team-1',
        });
        expect(landingQuery({ team: '' }, null, ['team-1'])).toBeNull();
    });

    it('never sends the grouping to the server', () => {
        expect(
            landingQuery({ team: 'team-2', group: 'team' }, 'team-1', [
                'team-1',
            ]),
        ).toEqual({ team: 'team-2' });
        expect(landingQuery({ group: 'team' }, null, ['team-1'])).toBeNull();
    });

    it('sends a stored entry of before unchanged, for the server to read', () => {
        expect(landingQuery({ status: 'overdue' }, null, [])).toEqual({
            status: 'overdue',
        });
    });
});

describe('stored entry', () => {
    it('reads the grouping and falls back to sprint', () => {
        expect(storedGrouping({ group: 'assignee' })).toBe('assignee');
        expect(storedGrouping({ group: 'status' })).toBe('sprint');
        expect(storedGrouping(null)).toBe('sprint');
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
                ...defaults,
                status: AllStatuses,
                assignee: 'me',
                team: 'team-1',
            }),
        ).toBe(3);
    });

    it('counts every narrowing facet', () => {
        expect(
            activeFilterCount({
                status: ['todo', 'doing'],
                priority: ['high'],
                due: 'today',
                source: 'retro',
                assignee: null,
                team: null,
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

        mount({ ...defaults, status: AllStatuses });

        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('stores what it applies and drops the item of a deep link', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?item=x');

        const { result } = mount({ ...defaults, team: 'team-1', item: 'x' });

        act(() => result.current.apply({ team: null, status: ['completed'] }));

        expect(stored()).toEqual({ status: 'completed' });
        expect(lastVisit().url).toContain('status=completed');
        expect(lastVisit().url).not.toContain('item=');
        expect(lastVisit().url).not.toContain('team=');
    });

    it('keeps the grouping in the same entry as the filters', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');
        window.localStorage.setItem(
            filterStorageKey(workspace.id),
            JSON.stringify({ team: 'team-1' }),
        );

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

        act(() => result.current.setGrouping('sprint'));

        expect(stored()).toEqual({ team: 'team-1' });

        act(() => result.current.setGrouping('none'));

        expect(stored()).toEqual({ team: 'team-1', group: 'none' });
    });

    it('does not store the team of the landing as a choice', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const landed = mount({ ...defaults, team: 'team-1' });

        act(() => landed.result.current.setGrouping('assignee'));
        expect(stored()).toEqual({ group: 'assignee' });

        act(() => landed.result.current.apply({ due: 'overdue' }));
        expect(stored()).toEqual({ due: 'overdue', group: 'assignee' });

        landed.unmount();
        window.history.replaceState({}, '', '/w/nordlys/action-items');
        mocks.get.mockReset();

        mount(defaults, 'team-2');

        expect(lastVisit().url).toContain('team=team-2');
        expect(lastVisit().url).toContain('due=overdue');
        expect(lastVisit().url).not.toContain('team-1');
    });

    it('stores the team the viewer picks', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const { result } = mount({ ...defaults, team: 'team-1' });

        act(() => result.current.apply({ team: 'team-2' }));

        expect(stored()).toEqual({ team: 'team-2' });
    });

    it('shows every team for this visit only after the cross of the team facet', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');
        window.localStorage.setItem(
            filterStorageKey(workspace.id),
            JSON.stringify({ team: 'team-2', status: 'all' }),
        );

        const { result, unmount } = mount({
            ...defaults,
            status: AllStatuses,
            team: 'team-2',
        });

        act(() => result.current.apply({ team: null }));

        expect(lastVisit().url).not.toContain('team=');
        expect(stored()).toEqual({ status: 'todo,doing,completed' });

        unmount();
        window.history.replaceState({}, '', '/w/nordlys/action-items');
        mocks.get.mockReset();
        mount();

        expect(lastVisit().url).toContain('team=team-1');
    });

    it('resets to the opening state: current team, open items, grouping by sprint', () => {
        window.history.replaceState(
            {},
            '',
            '/w/nordlys/action-items?team=team-2&status=all',
        );
        window.localStorage.setItem(
            filterStorageKey(workspace.id),
            JSON.stringify({ team: 'team-2', status: 'all', group: 'team' }),
        );

        const { result, unmount } = mount({
            ...defaults,
            status: AllStatuses,
            assignee: 'me',
            team: 'team-2',
        });

        act(() => result.current.reset());

        expect(stored()).toBeNull();
        expect(result.current.grouping).toBe('sprint');
        expect(lastVisit().url).toContain('?team=team-1');
        expect(lastVisit().url).not.toContain('status');
        expect(lastVisit().url).not.toContain('assignee');

        unmount();
        window.history.replaceState({}, '', '/w/nordlys/action-items');
        mocks.get.mockReset();
        mount();

        expect(lastVisit().url).toContain('team=team-1');
    });

    it('resets to every team without a current team the viewer can see', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const { result } = mount({ ...defaults, team: 'team-2' }, 'team-9');

        act(() => result.current.reset());

        expect(lastVisit().url).not.toContain('?');
    });

    it('is at its default on the opening state only', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const opening = mount({ ...defaults, team: 'team-1' });

        expect(opening.result.current.isDefault).toBe(true);

        act(() => opening.result.current.setGrouping('assignee'));
        expect(opening.result.current.isDefault).toBe(false);
        opening.unmount();
        window.localStorage.clear();

        expect(mount(defaults).result.current.isDefault).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-2' }).result.current.isDefault,
        ).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-1', status: AllStatuses }).result
                .current.isDefault,
        ).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-1', priority: ['high'] }).result
                .current.isDefault,
        ).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-1', due: 'today' }).result.current
                .isDefault,
        ).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-1', source: 'retro' }).result
                .current.isDefault,
        ).toBe(false);
        expect(
            mount({ ...defaults, team: 'team-1', status: ['doing', 'todo'] })
                .result.current.isDefault,
        ).toBe(true);
        expect(mount(defaults, null).result.current.isDefault).toBe(true);
    });

    it('is loading while the landing visit runs', () => {
        const { result } = mount();
        const { onStart, onFinish } = lastVisit().options as {
            onStart: () => void;
            onFinish: () => void;
        };

        act(() => onStart());
        expect(result.current.loading).toBe(true);

        act(() => onFinish());
        expect(result.current.loading).toBe(false);
    });

    it('is loading between the start and the end of a filter visit', () => {
        window.history.replaceState({}, '', '/w/nordlys/action-items?team=t');

        const { result } = mount({ ...defaults, team: 'team-1' });

        act(() => result.current.apply({ status: AllStatuses }));

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
