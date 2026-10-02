import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';

export type TemplateKind = 'retro' | 'poker' | 'whiteboard';

/** The team whose "New session" dialog opens on the template. */
type TemplateUseTarget = { workspace: string; team: string };

const WorkspaceTemplateKeyPrefix = 'workspace:';

/** Key of a workspace template in the catalogue of a retro or a whiteboard. */
export function workspaceTemplateKey(id: string): string {
    return `${WorkspaceTemplateKeyPrefix}${id}`;
}

/**
 * The page of the team with the query that `useNewSessionIntent` reads:
 * `?new=retro&template=<key>`, `?new=whiteboard&template=workspace:<id>` or
 * `?new=poker&deck=<id>`. `null` without a team.
 */
export function templateHref(
    kind: TemplateKind,
    key: string,
    target: TemplateUseTarget | null,
): string | null {
    if (target === null) {
        return null;
    }

    return TeamsController.show.url(target, {
        query:
            kind === 'poker'
                ? { new: kind, deck: key }
                : { new: kind, template: key },
    });
}

type TemplateHrefFor = (kind: TemplateKind, key: string) => string | null;

/** `templateHref` for the current team of the page, and whether there is one. */
export function useTemplateHref(
    workspaceSlug: string,
    /** Given by the bench in place of the current team; `null`: no team. */
    team?: string | null,
): {
    hrefFor: TemplateHrefFor;
    hasTeam: boolean;
} {
    const { currentTeam } = usePage().props;
    const teamId = team === undefined ? (currentTeam?.id ?? null) : team;

    const hrefFor = useCallback<TemplateHrefFor>(
        (kind, key) =>
            templateHref(
                kind,
                key,
                teamId === null
                    ? null
                    : { workspace: workspaceSlug, team: teamId },
            ),
        [workspaceSlug, teamId],
    );

    return { hrefFor, hasTeam: teamId !== null };
}
