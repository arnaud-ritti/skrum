import { describe, expect, it } from 'vitest';
import { groupItems, isActionItemGrouping } from '@/lib/action-items/grouping';
import type { ActionItemGroupLabels } from '@/lib/action-items/grouping';
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
    it('accepts the three groupings and nothing else', () => {
        expect(isActionItemGrouping('team')).toBe(true);
        expect(isActionItemGrouping('assignee')).toBe(true);
        expect(isActionItemGrouping('none')).toBe(true);
        expect(isActionItemGrouping('status')).toBe(false);
        expect(isActionItemGrouping(undefined)).toBe(false);
    });
});
