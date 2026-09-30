import type {
    ActionItem,
    ActionItemComment,
    Snapshot,
} from '@/lib/retro/types';

/**
 * What the client knows about the viewer to show or hide controls; the
 * server stays the authority (spec §4).
 */
export type ActionItemViewer = {
    userId: string | null;
    participantId: string | null;
    isWorkspaceManager: boolean;
    facilitatedRetroIds: string[];
    reviewTeamIds: string[];
};

export function canManageActionItem(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    if (item.isMine || viewer.isWorkspaceManager) {
        return true;
    }

    return (
        item.retroId !== null &&
        viewer.facilitatedRetroIds.includes(item.retroId)
    );
}

export function isActionItemAssignee(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    if (item.assignee === null) {
        return false;
    }

    if (item.assignee.kind === 'member') {
        return item.assignee.id === viewer.userId;
    }

    return item.assignee.id === viewer.participantId;
}

export function canCompleteActionItem(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    return (
        canManageActionItem(item, viewer) ||
        isActionItemAssignee(item, viewer) ||
        viewer.reviewTeamIds.includes(item.teamId)
    );
}

export function canDeleteActionItemComment(
    comment: ActionItemComment,
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    return comment.isMine || canManageActionItem(item, viewer);
}

export function boardActionItemViewer(board: Snapshot): ActionItemViewer {
    return {
        userId: board.viewer.userId,
        participantId: board.viewer.participantId,
        isWorkspaceManager: board.viewer.isWorkspaceManager,
        facilitatedRetroIds: board.viewer.facilitatedRetroIds,
        reviewTeamIds: board.viewer.isReviewFacilitator
            ? [board.retro.teamId]
            : [],
    };
}
