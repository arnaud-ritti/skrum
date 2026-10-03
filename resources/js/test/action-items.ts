import { vi } from 'vitest';
import type { ActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem } from '@/lib/retro/types';

export function actionItemFixture(
    overrides: Partial<ActionItem> = {},
): ActionItem {
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
        assignee: null,
        createdBy: { name: 'Alice Martin', avatarUrl: '/avatars/alice.svg' },
        isMine: true,
        commentCount: 0,
        source: null,
        themeId: null,
        themeName: null,
        recurrence: null,
        previousOccurrenceId: null,
        subtasks: [],
        createdAt: '2026-10-02T10:00:00Z',
        externalLinks: [],
        cardId: null,
        ...overrides,
    };
}

export function actionItemViewerFixture(
    overrides: Partial<ActionItemViewer> = {},
): ActionItemViewer {
    return {
        userId: 'user-1',
        participantId: null,
        isWorkspaceManager: false,
        facilitatedRetroIds: [],
        reviewTeamIds: [],
        ...overrides,
    };
}

/** Routes a test can read back: the method and a url that names the call. */
export function actionItemEndpointsFixture(): ActionItemEndpoints {
    return {
        update: (id) => ({ url: `/items/${id}`, method: 'patch' }),
        destroy: (id) => ({ url: `/items/${id}`, method: 'delete' }),
        comments: (id) => ({ url: `/items/${id}/comments`, method: 'get' }),
        addComment: (id) => ({ url: `/items/${id}/comments`, method: 'post' }),
        updateComment: (id) => ({ url: `/comments/${id}`, method: 'patch' }),
        destroyComment: (id) => ({ url: `/comments/${id}`, method: 'delete' }),
        addSubtask: (id) => ({ url: `/items/${id}/subtasks`, method: 'post' }),
        updateSubtask: (id) => ({ url: `/subtasks/${id}`, method: 'patch' }),
        destroySubtask: (id) => ({ url: `/subtasks/${id}`, method: 'delete' }),
        exportItem: (id) => ({ url: `/items/${id}/exports`, method: 'post' }),
        exportPreview: (id, source) => ({
            url: `/items/${id}/exports/preview?source=${source}`,
            method: 'get',
        }),
        syncLink: (id, link) => ({
            url: `/items/${id}/links/${link}/sync`,
            method: 'post',
        }),
    };
}

/** What a container provides: a `run` that swallows a failure, as the real one. */
export function actionItemMutationsFixture(
    overrides: Partial<ActionItemMutationsValue> = {},
): ActionItemMutationsValue {
    return {
        endpoints: actionItemEndpointsFixture(),
        run: async <T>(request: Promise<T>) => {
            try {
                return await request;
            } catch {
                return undefined;
            }
        },
        onSaved: vi.fn(),
        onCommentCount: vi.fn(),
        ...overrides,
    };
}
