import { describe, expect, it } from 'vitest';
import { readNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import {
    templateHref,
    workspaceTemplateKey,
} from '@/lib/workspaces/use-template';

const target = { workspace: 'nordlys', team: 'team-1' };

function intentOf(href: string | null) {
    return readNewSessionIntent(new URL(href ?? '', 'http://localhost').search);
}

describe('templateHref', () => {
    it('opens the retro form of the team on a built-in template', () => {
        const href = templateHref('retro', 'four_ls', target);

        expect(href).toContain('/w/nordlys/teams/team-1?');
        expect(intentOf(href)).toEqual({ type: 'retro', template: 'four_ls' });
    });

    it('opens the retro form on a workspace template by its catalogue key', () => {
        const href = templateHref(
            'retro',
            workspaceTemplateKey('template-1'),
            target,
        );

        expect(intentOf(href)).toEqual({
            type: 'retro',
            template: 'workspace:template-1',
        });
    });

    it('opens the poker form on a deck', () => {
        expect(intentOf(templateHref('poker', 'deck-1', target))).toEqual({
            type: 'poker',
            deck: 'deck-1',
        });
    });

    it('opens the whiteboard form on a workspace template', () => {
        expect(
            intentOf(
                templateHref(
                    'whiteboard',
                    workspaceTemplateKey('board-1'),
                    target,
                ),
            ),
        ).toEqual({ type: 'whiteboard', template: 'workspace:board-1' });
    });

    it('has no link without a team', () => {
        expect(templateHref('retro', 'four_ls', null)).toBeNull();
        expect(templateHref('poker', 'deck-1', null)).toBeNull();
        expect(
            templateHref('whiteboard', 'workspace:board-1', null),
        ).toBeNull();
    });
});
