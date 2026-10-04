import { describe, expect, it } from 'vitest';
import {
    groupItems,
    isActionItemGrouping,
    sprintOfItem,
} from '@/lib/action-items/grouping';
import type {
    ActionItemGroupLabels,
    ActionItemSprint,
} from '@/lib/action-items/grouping';
import { actionItemFixture } from '@/test/action-items';

const labels: ActionItemGroupLabels = {
    team: (teamId) => `Team ${teamId}`,
    assignee: (assignee) => assignee?.name ?? 'Unassigned',
};

const alice = {
    kind: 'member' as const,
    id: 'user-1',
    name: 'Alice Martin',
    avatarUrl: '/avatars/alice.svg',
    isTeamMember: true,
};

const items = [
    actionItemFixture({ id: 'a', teamId: 'atlas', assignee: alice }),
    actionItemFixture({ id: 'b', teamId: 'mobile', assignee: null }),
    actionItemFixture({ id: 'c', teamId: 'atlas', assignee: null }),
    actionItemFixture({ id: 'd', teamId: 'mobile', assignee: alice }),
];

function shape(groups: ReturnType<typeof groupItems>) {
    return groups.map((group) => ({
        key: group.key,
        label: group.label,
        ids: group.items.map((item) => item.id),
    }));
}

describe('groupItems', () => {
    it('keeps a flat list as one group without a label', () => {
        expect(shape(groupItems(items, 'none', labels))).toEqual([
            { key: 'all', label: '', ids: ['a', 'b', 'c', 'd'] },
        ]);
    });

    it('groups by team, in the order of the first row of each team', () => {
        expect(shape(groupItems(items, 'team', labels))).toEqual([
            { key: 'atlas', label: 'Team atlas', ids: ['a', 'c'] },
            { key: 'mobile', label: 'Team mobile', ids: ['b', 'd'] },
        ]);
    });

    it('groups by assignee and keeps the unassigned rows together', () => {
        expect(shape(groupItems(items, 'assignee', labels))).toEqual([
            { key: 'member:user-1', label: 'Alice Martin', ids: ['a', 'd'] },
            { key: 'none', label: 'Unassigned', ids: ['b', 'c'] },
        ]);
    });

    it('tells a member from a guest who has the same id', () => {
        const guest = { ...alice, kind: 'guest' as const, isTeamMember: false };
        const groups = groupItems(
            [
                actionItemFixture({ id: 'a', assignee: alice }),
                actionItemFixture({ id: 'b', assignee: guest }),
            ],
            'assignee',
            labels,
        );

        expect(groups.map((group) => group.key)).toEqual([
            'member:user-1',
            'guest:user-1',
        ]);
    });

    it('returns no group for an empty page', () => {
        expect(groupItems([], 'none', labels)).toEqual([]);
        expect(groupItems([], 'team', labels)).toEqual([]);
    });
});

describe('isActionItemGrouping', () => {
    it('accepts the four groupings and nothing else', () => {
        expect(isActionItemGrouping('sprint')).toBe(true);
        expect(isActionItemGrouping('team')).toBe(true);
        expect(isActionItemGrouping('assignee')).toBe(true);
        expect(isActionItemGrouping('none')).toBe(true);
        expect(isActionItemGrouping('status')).toBe(false);
        expect(isActionItemGrouping(undefined)).toBe(false);
    });
});

describe('grouping by sprint', () => {
    const sprint = (
        id: string,
        number: number,
        teamId: string,
        state: ActionItemSprint['state'],
        itemIds: string[],
    ): ActionItemSprint => ({
        id,
        number,
        startsOn: '2026-09-21',
        endsOn: '2026-10-04',
        teamId,
        state,
        itemIds,
    });
    const sprintLabels: ActionItemGroupLabels = {
        ...labels,
        sprint: (found, withTeam) =>
            withTeam
                ? `${found.teamId} · Sprint ${found.number}`
                : `Sprint ${found.number}`,
        noSprint: 'No sprint',
    };
    const rows = [
        actionItemFixture({ id: 'a', teamId: 't1' }),
        actionItemFixture({ id: 'b', teamId: 't1' }),
        actionItemFixture({ id: 'c', teamId: 't1' }),
        actionItemFixture({ id: 'd', teamId: 't1' }),
    ];

    it('groups in the order of the sprints, keeps the order of the rows, and puts "No sprint" last', () => {
        const page = {
            sprints: [
                sprint('s42', 42, 't1', 'current', ['c']),
                sprint('s41', 41, 't1', 'finished', ['a', 'd']),
            ],
            withoutSprint: ['b'],
        };

        expect(shape(groupItems(rows, 'sprint', sprintLabels, page))).toEqual([
            { key: 'sprint-s42', label: 'Sprint 42', ids: ['c'] },
            { key: 'sprint-s41', label: 'Sprint 41', ids: ['a', 'd'] },
            { key: 'no-sprint', label: 'No sprint', ids: ['b'] },
        ]);
    });

    it('names the team when the page spans several teams', () => {
        const page = {
            sprints: [
                sprint('s42', 42, 't1', 'current', ['a']),
                sprint('n42', 42, 't2', 'current', ['e']),
            ],
            withoutSprint: [],
        };
        const twoTeams = [
            rows[0],
            actionItemFixture({ id: 'e', teamId: 't2' }),
        ];

        expect(
            shape(groupItems(twoTeams, 'sprint', sprintLabels, page)).map(
                (group) => group.label,
            ),
        ).toEqual(['t1 · Sprint 42', 't2 · Sprint 42']);
    });

    it("places a live row in its team's current sprint", () => {
        const page = {
            sprints: [sprint('s42', 42, 't1', 'current', [])],
            withoutSprint: ['a'],
        };

        expect(sprintOfItem(rows[0], page)).toBeNull();
        expect(sprintOfItem(rows[1], page)?.id).toBe('s42');
        expect(
            sprintOfItem(actionItemFixture({ id: 'x', teamId: 't9' }), page),
        ).toBeNull();
    });

    it('draws no group row when no row of the page has a sprint', () => {
        expect(
            shape(
                groupItems(rows, 'sprint', sprintLabels, {
                    sprints: [],
                    withoutSprint: ['a', 'b', 'c', 'd'],
                }),
            ),
        ).toEqual([{ key: 'all', label: '', ids: ['a', 'b', 'c', 'd'] }]);
    });
});
