import PokerImportContainersController from '@/actions/App/Http/Controllers/Integrations/PokerImportContainersController';
import PokerImportIterationsController from '@/actions/App/Http/Controllers/Integrations/PokerImportIterationsController';
import PokerImportPreviewsController from '@/actions/App/Http/Controllers/Integrations/PokerImportPreviewsController';
import TeamPokerImportContainersController from '@/actions/App/Http/Controllers/Integrations/TeamPokerImportContainersController';
import TeamPokerImportIterationsController from '@/actions/App/Http/Controllers/Integrations/TeamPokerImportIterationsController';
import TeamPokerImportPreviewsController from '@/actions/App/Http/Controllers/Integrations/TeamPokerImportPreviewsController';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type {
    PokerTrackerSource,
    TrackerContainer,
    TrackerIssuePreview,
    TrackerIteration,
} from './types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

export type ImportTerms = {
    container: string;
    searchContainers: string;
    chooseContainer: string;
    iteration: string;
    chooseIteration: string;
    noIteration: string;
    queryPlaceholder: string;
};

export type TrackerPreview = {
    issues: TrackerIssuePreview[];
    truncated: boolean;
};

export type TrackerPreviewRequest =
    | { mode: 'iteration'; iteration_id: string }
    | { mode: 'query'; query: string; container: string | undefined };

/** Where a tracker is browsed from: a game being played, or a team creating one. */
export type TrackerBrowseApi = {
    containers: (
        source: PokerTrackerSource,
        q: string,
        page: number,
    ) => Promise<{ containers: TrackerContainer[] }>;
    iterations: (
        source: PokerTrackerSource,
        container: string,
    ) => Promise<TrackerIteration[]>;
    preview: (
        source: PokerTrackerSource,
        body: TrackerPreviewRequest,
    ) => Promise<TrackerPreview>;
};

export function importTerms(
    source: PokerTrackerSource,
    t: Translate,
): ImportTerms {
    switch (source) {
        case 'jira':
        case 'jira_dc':
            return {
                container: t('Board'),
                searchContainers: t('Search boards'),
                chooseContainer: t('Choose a board'),
                iteration: t('Sprint'),
                chooseIteration: t('Choose a sprint'),
                noIteration: t('No active or upcoming sprint.'),
                queryPlaceholder: t(
                    'JQL, for example project = PROJ AND sprint in openSprints()',
                ),
            };
        case 'github':
            return {
                container: t('Repository'),
                searchContainers: t('Search repositories'),
                chooseContainer: t('Choose a repository'),
                iteration: t('Milestone'),
                chooseIteration: t('Choose a milestone'),
                noIteration: t('No open milestone.'),
                queryPlaceholder: t('Search GitHub issues'),
            };
        default:
            return {
                container: t('Team'),
                searchContainers: t('Search teams'),
                chooseContainer: t('Choose a team'),
                iteration: t('Cycle'),
                chooseIteration: t('Choose a cycle'),
                noIteration: t('No active or upcoming cycle.'),
                queryPlaceholder: t('Search Linear issues'),
            };
    }
}

/** "9 of 12 selected": the bar under the tickets. */
export function selectionLabel(
    selected: number,
    total: number,
    t: Translate,
): string {
    return t(':selected of :total selected', { selected, total });
}

/** Every ticket not imported yet, in the list's order; none when they are all selected already. */
export function toggleAll(
    issues: TrackerIssuePreview[],
    selected: string[],
): string[] {
    const importable = issues
        .filter((issue) => !issue.alreadyImported)
        .map((issue) => issue.externalId);

    const allSelected = importable.every((id) => selected.includes(id));

    return allSelected ? [] : importable;
}

/** The message a failed browse shows, for a page without the room's error handling. */
export function browseErrorMessage(error: unknown, t: Translate): string {
    if (!(error instanceof RetroRequestError)) {
        return t('Something went wrong. Please try again.');
    }

    if (error.status === 0) {
        return t('The server did not respond in time. Please try again.');
    }

    return error.message || t('Something went wrong. Please try again.');
}

export function gameBrowseApi(gameId: string): TrackerBrowseApi {
    return {
        containers: (source, q, page) =>
            retroRequest(
                PokerImportContainersController.index(
                    { game: gameId, source },
                    { query: { q, page } },
                ),
            ),
        iterations: (source, container) =>
            retroRequest(
                PokerImportIterationsController.index(
                    { game: gameId, source },
                    { query: { container } },
                ),
            ),
        preview: (source, body) =>
            retroRequest(
                PokerImportPreviewsController.store({ game: gameId, source }),
                body,
            ),
    };
}

export function teamBrowseApi(
    workspace: string,
    teamId: string,
): TrackerBrowseApi {
    return {
        containers: (source, q, page) =>
            retroRequest(
                TeamPokerImportContainersController.index(
                    { workspace, team: teamId, source },
                    { query: { q, page } },
                ),
            ),
        iterations: (source, container) =>
            retroRequest(
                TeamPokerImportIterationsController.index(
                    { workspace, team: teamId, source },
                    { query: { container } },
                ),
            ),
        preview: (source, body) =>
            retroRequest(
                TeamPokerImportPreviewsController.store({
                    workspace,
                    team: teamId,
                    source,
                }),
                body,
            ),
    };
}
