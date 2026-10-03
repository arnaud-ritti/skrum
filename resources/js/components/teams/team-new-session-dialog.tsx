import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    icebreakerSessionForm,
    roomLimitReason,
} from '@/components/teams/session-create/icebreaker-session-fields';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { pokerSessionForm } from '@/components/teams/session-create/poker-session-fields';
import { retroSessionForm } from '@/components/teams/session-create/retro-session-fields';
import { surveySessionForm } from '@/components/teams/session-create/survey-session-fields';
import type { NewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { whiteboardSessionForm } from '@/components/teams/session-create/whiteboard-session-fields';
import { useTrans } from '@/hooks/use-trans';
import type { NewSessionOptions, TeamSummary, WorkspaceSummary } from '@/types';

type TeamNewSessionDialogProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    options: NewSessionOptions;
    /** What the address asks for: `useNewSessionIntent()` of the page. */
    intent: NewSessionIntent | null;
    trigger: ReactNode;
};

/**
 * The "New session" dialog of a team, with the five forms built from
 * `PresentNewSessionOptions`: shared by the team page and the Sessions page.
 */
export function TeamNewSessionDialog({
    workspace,
    team,
    options,
    intent,
    trigger,
}: TeamNewSessionDialogProps) {
    const { t } = useTrans();
    const { currentWorkspace } = usePage().props;
    const canManageTemplates =
        currentWorkspace?.role === 'owner' ||
        currentWorkspace?.role === 'admin';

    return (
        <NewSessionDialog
            trigger={trigger}
            team={team}
            intent={intent}
            retro={
                options.canCreateRetro
                    ? retroSessionForm({
                          workspaceSlug: workspace.slug,
                          categories: options.templateCategories,
                          catalogue: options.catalogue,
                          topTemplates: options.topTemplates,
                          llm: options.llm,
                          icebreakerGames: options.icebreakerGames,
                          canSaveTemplate: canManageTemplates,
                      })
                    : undefined
            }
            poker={
                options.canCreatePokerGame
                    ? pokerSessionForm({
                          workspaceSlug: workspace.slug,
                          deckOptions: options.pokerDeckOptions,
                          savedDecks: options.pokerDecks,
                          defaultPokerDeck: options.defaultPokerDeck,
                          pokerSources: options.pokerSources,
                      })
                    : undefined
            }
            whiteboard={
                options.canCreateWhiteboard
                    ? whiteboardSessionForm({
                          workspaceSlug: workspace.slug,
                          gallery: options.whiteboardGallery,
                      })
                    : undefined
            }
            survey={surveySessionForm({
                workspaceSlug: workspace.slug,
                templates: options.surveyTemplates,
                surveys: options.surveys,
                disabledReason: options.canCreateSurvey
                    ? undefined
                    : t('You cannot create a survey in this team.'),
            })}
            icebreaker={icebreakerSessionForm({
                workspaceSlug: workspace.slug,
                gameOptions: options.gameOptions,
                disabledReason: roomLimitReason(
                    options.canCreateGameRoom,
                    options.roomLimit,
                    t,
                ),
            })}
        />
    );
}
