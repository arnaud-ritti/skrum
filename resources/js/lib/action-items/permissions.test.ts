import { describe, expect, it } from 'vitest';
import {
    boardActionItemViewer,
    canCompleteActionItem,
    canManageActionItem,
} from '@/lib/action-items/permissions';
import {
    actionItemFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { retroSnapshot } from '@/test/retro-board';

describe('action item permissions', () => {
    it('makes the items of an observed team read-only, even the viewer’s own or assigned ones', () => {
        const viewer = actionItemViewerFixture({ observedTeamIds: ['team-1'] });
        const item = actionItemFixture({
            isMine: true,
            assignee: {
                kind: 'member',
                id: 'user-1',
                name: 'Alice Martin',
                avatarUrl: '/avatars/alice.svg',
                isTeamMember: true,
            },
        });

        expect(canManageActionItem(item, viewer)).toBe(false);
        expect(canCompleteActionItem(item, viewer)).toBe(false);
    });

    it('leaves the items of the other teams as they were', () => {
        const viewer = actionItemViewerFixture({ observedTeamIds: ['team-2'] });
        const item = actionItemFixture({ isMine: true });

        expect(canManageActionItem(item, viewer)).toBe(true);
        expect(canCompleteActionItem(item, viewer)).toBe(true);
    });

    it('makes the board items read-only for an observer of the retro team', () => {
        const viewer = boardActionItemViewer(
            retroSnapshot({ viewerIsObserver: true }),
        );
        const item = actionItemFixture({ isMine: true });

        expect(canManageActionItem(item, viewer)).toBe(false);
        expect(canCompleteActionItem(item, viewer)).toBe(false);
    });
});
