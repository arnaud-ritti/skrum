import { describe, expect, it } from 'vitest';
import {
    newItemToPayload,
    ownerOptions,
    patchToPayload,
    toActionItemData,
} from '@/components/action-items/action-item-adapters';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem } from '@/lib/retro/types';

function actionItem(overrides: Partial<ActionItem> = {}): ActionItem {
    return {
        id: 'item-1',
        retroId: 'retro-1',
        teamId: 'team-1',
        content: 'Quarantine the flaky tests',
        priority: 'medium',
        dueOn: '2026-10-17',
        isOverdue: false,
        status: 'open',
        completedAt: null,
        completedVia: null,
        assignee: {
            kind: 'member',
            id: 'user-2',
            name: 'Bob Stone',
            avatarUrl: '/avatars/bob.svg',
            isTeamMember: true,
        },
        createdBy: { name: 'Alice Martin', avatarUrl: '/avatars/alice.svg' },
        isMine: false,
        commentCount: 2,
        source: {
            retroTitle: 'Sprint 42',
            retroCreatedAt: '2026-10-01T09:00:00Z',
            retroUrl: '/retros/retro-1',
        },
        themeId: null,
        themeName: 'CI',
        recurrence: null,
        previousOccurrenceId: null,
        subtasks: [
            { id: 's1', content: 'One', isCompleted: true, position: 0 },
            { id: 's2', content: 'Two', isCompleted: false, position: 1 },
        ],
        createdAt: '2026-10-02T10:00:00Z',
        externalLinks: null,
        ...overrides,
    };
}

function viewer(overrides: Partial<ActionItemViewer> = {}): ActionItemViewer {
    return {
        userId: 'user-9',
        participantId: null,
        isWorkspaceManager: false,
        facilitatedRetroIds: [],
        reviewTeamIds: [],
        ...overrides,
    };
}

describe('toActionItemData', () => {
    it('maps the server item on the fields of the component', () => {
        const data = toActionItemData(actionItem(), {
            locale: 'en',
            teamName: 'Platform',
            viewer: viewer(),
        });

        expect(data).toMatchObject({
            title: 'Quarantine the flaky tests',
            status: 'open',
            priority: 'medium',
            dueDate: '2026-10-17',
            overdue: false,
            doneAt: null,
            completedVia: null,
            createdBy: { name: 'Alice Martin' },
            themeName: 'CI',
            teamName: 'Platform',
            recurrence: null,
            followUpDate: null,
            commentCount: 2,
            links: null,
            locale: 'en',
        });
        expect(data.subtasks).toEqual([
            { isCompleted: true },
            { isCompleted: false },
        ]);
    });

    it('passes the guest flag of the owner and never writes the label', () => {
        const data = toActionItemData(
            actionItem({
                assignee: {
                    kind: 'guest',
                    id: 'participant-3',
                    name: 'Carol Guest',
                    avatarUrl: '/avatars/carol.svg',
                    isTeamMember: false,
                },
            }),
            { locale: 'en', viewer: viewer() },
        );

        expect(data.owner).toEqual({
            id: 'participant-3',
            name: 'Carol Guest',
            kind: 'guest',
            isTeamMember: false,
            avatarUrl: '/avatars/carol.svg',
        });
    });

    it('has no owner for an unassigned item', () => {
        const data = toActionItemData(actionItem({ assignee: null }), {
            locale: 'en',
            viewer: viewer(),
        });

        expect(data.owner).toBeNull();
    });

    it('names the source retro with its date and links to it', () => {
        const data = toActionItemData(actionItem(), {
            locale: 'en',
            viewer: viewer(),
        });

        expect(data.source).toEqual({
            label: 'Sprint 42 · Oct 1, 2026',
            url: '/retros/retro-1',
            retroId: 'retro-1',
        });
    });

    it('has no source for an item added outside a retro', () => {
        const data = toActionItemData(
            actionItem({ source: null, retroId: null }),
            { locale: 'en', viewer: viewer() },
        );

        expect(data.source).toBeNull();
    });

    it('lets the container replace or hide the source', () => {
        const context = { locale: 'en', viewer: viewer() };

        expect(
            toActionItemData(actionItem(), {
                ...context,
                sourceLabel: 'CI is flaky',
            }).source,
        ).toEqual({
            label: 'CI is flaky',
            url: '/retros/retro-1',
            retroId: 'retro-1',
        });
        expect(
            toActionItemData(actionItem(), { ...context, sourceLabel: null })
                .source,
        ).toBeNull();
        expect(
            toActionItemData(actionItem({ source: null, retroId: null }), {
                ...context,
                sourceLabel: 'CI is flaky',
            }).source,
        ).toEqual({ label: 'CI is flaky' });
    });

    it('dates the follow-up of a recurring item from its creation', () => {
        const context = { locale: 'en', viewer: viewer() };

        expect(
            toActionItemData(
                actionItem({
                    recurrence: 'weekly',
                    previousOccurrenceId: 'item-0',
                }),
                context,
            ).followUpDate,
        ).toBe('2026-10-02T10:00:00Z');
        expect(
            toActionItemData(actionItem({ recurrence: 'weekly' }), context)
                .followUpDate,
        ).toBeNull();
    });

    it('keeps a former member as a null creator', () => {
        const data = toActionItemData(actionItem({ createdBy: null }), {
            locale: 'en',
            viewer: viewer(),
        });

        expect(data.createdBy).toBeNull();
    });

    it('lets the assignee, a reviewer and a manager complete, and nobody else', () => {
        const context = { locale: 'en' };

        expect(
            toActionItemData(actionItem(), { ...context, viewer: viewer() })
                .canComplete,
        ).toBe(false);
        expect(
            toActionItemData(actionItem(), {
                ...context,
                viewer: viewer({ userId: 'user-2' }),
            }).canComplete,
        ).toBe(true);
        expect(
            toActionItemData(actionItem(), {
                ...context,
                viewer: viewer({ reviewTeamIds: ['team-1'] }),
            }).canComplete,
        ).toBe(true);
        expect(
            toActionItemData(actionItem(), {
                ...context,
                viewer: viewer({ facilitatedRetroIds: ['retro-1'] }),
            }).canComplete,
        ).toBe(true);
        expect(
            toActionItemData(actionItem({ isMine: true }), {
                ...context,
                viewer: viewer(),
            }).canComplete,
        ).toBe(true);
    });
});

describe('patchToPayload', () => {
    it('sends only what changed', () => {
        expect(
            patchToPayload(
                {
                    title: 'Quarantine the flaky tests',
                    priority: 'high',
                    dueDate: '2026-10-17',
                },
                actionItem(),
            ),
        ).toEqual({ priority: 'high' });
    });

    it('sends nothing for an unchanged or empty title', () => {
        expect(
            patchToPayload(
                { title: '  Quarantine the flaky tests ' },
                actionItem(),
            ),
        ).toEqual({});
        expect(patchToPayload({ title: '   ' }, actionItem())).toEqual({});
    });

    it('trims a new title into the content', () => {
        expect(
            patchToPayload({ title: '  Add a second runner ' }, actionItem()),
        ).toEqual({ content: 'Add a second runner' });
    });

    it('sends a new due date, and null for a cleared one', () => {
        expect(patchToPayload({ dueDate: '2026-11-03' }, actionItem())).toEqual(
            { due_on: '2026-11-03' },
        );
        expect(patchToPayload({ dueDate: null }, actionItem())).toEqual({
            due_on: null,
        });
    });

    it('stops the recurrence with the due date', () => {
        expect(
            patchToPayload(
                { dueDate: null },
                actionItem({ recurrence: 'weekly' }),
            ),
        ).toEqual({ due_on: null, recurrence: null });
        expect(
            patchToPayload(
                { dueDate: null, recurrence: 'monthly' },
                actionItem({ recurrence: 'weekly' }),
            ),
        ).toEqual({ due_on: null, recurrence: null });
    });

    it('sends a changed recurrence', () => {
        expect(patchToPayload({ recurrence: 'monthly' }, actionItem())).toEqual(
            { recurrence: 'monthly' },
        );
        expect(
            patchToPayload(
                { recurrence: null },
                actionItem({ recurrence: 'weekly' }),
            ),
        ).toEqual({ recurrence: null });
        expect(patchToPayload({ recurrence: null }, actionItem())).toEqual({});
    });

    it('sends a member as a user and a guest as a participant', () => {
        expect(
            patchToPayload(
                { owner: { id: 'user-5', name: 'Eve', kind: 'member' } },
                actionItem(),
            ),
        ).toEqual({
            assignee_user_id: 'user-5',
            assignee_participant_id: null,
        });
        expect(
            patchToPayload(
                {
                    owner: {
                        id: 'participant-3',
                        name: 'Carol',
                        kind: 'guest',
                    },
                },
                actionItem(),
            ),
        ).toEqual({
            assignee_user_id: null,
            assignee_participant_id: 'participant-3',
        });
    });

    it('unassigns, and sends nothing when the owner is the same', () => {
        expect(patchToPayload({ owner: null }, actionItem())).toEqual({
            assignee_user_id: null,
            assignee_participant_id: null,
        });
        expect(
            patchToPayload(
                { owner: { id: 'user-2', name: 'Bob Stone', kind: 'member' } },
                actionItem(),
            ),
        ).toEqual({});
        expect(
            patchToPayload({ owner: null }, actionItem({ assignee: null })),
        ).toEqual({});
    });
});

describe('newItemToPayload', () => {
    it('writes the body of the store endpoints', () => {
        expect(
            newItemToPayload({
                title: '  Document the pipeline restart ',
                priority: 'high',
                dueDate: '2026-10-24',
                recurrence: 'weekly',
                owner: { id: 'user-2', name: 'Bob Stone', kind: 'member' },
            }),
        ).toEqual({
            content: 'Document the pipeline restart',
            priority: 'high',
            due_on: '2026-10-24',
            recurrence: 'weekly',
            assignee_user_id: 'user-2',
            assignee_participant_id: null,
        });
    });

    it('never repeats an item without a due date', () => {
        expect(
            newItemToPayload({
                title: 'Tidy the backlog',
                priority: 'medium',
                dueDate: null,
                recurrence: 'weekly',
                owner: null,
            }),
        ).toMatchObject({
            due_on: null,
            recurrence: null,
            assignee_user_id: null,
            assignee_participant_id: null,
        });
    });
});

describe('ownerOptions', () => {
    it('turns team members into owners of the team', () => {
        expect(
            ownerOptions([
                { id: 'user-1', name: 'Alice Martin', avatarUrl: '/a.svg' },
                { id: 'user-2', name: 'Bob Stone' },
            ]),
        ).toEqual([
            {
                id: 'user-1',
                name: 'Alice Martin',
                kind: 'member',
                isTeamMember: true,
                avatarUrl: '/a.svg',
            },
            {
                id: 'user-2',
                name: 'Bob Stone',
                kind: 'member',
                isTeamMember: true,
                avatarUrl: null,
            },
        ]);
    });
});
