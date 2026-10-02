import { MessageSquare } from 'lucide-react';
import { useId, useState } from 'react';
import SurveyCommentsController from '@/actions/App/Http/Controllers/Retros/SurveyCommentsController';
import SurveyReactionsController from '@/actions/App/Http/Controllers/Retros/SurveyReactionsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { fetchSurvey, SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyComment, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import {
    CommentThreadList,
    type CommentThreadActions,
} from '../comment-thread';
import { optimisticReactions, ReactionChips } from '../reaction-chips';

/**
 * The foot of a survey: its reactions, and its comments once the viewer has
 * answered. A completed retro takes no answer, so it never asks for one.
 */
export function SurveyDiscussion({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const threadsId = useId();
    const [open, setOpen] = useState(false);
    const { retro } = ctx.board;
    const route = { retro: retro.id, survey: survey.id };
    const canDiscuss =
        ctx.isEditable &&
        survey.resultsVisible &&
        SurveyPhases.includes(retro.phase);
    const commentsLabel = t('Comments (:count)', {
        count: survey.commentCount,
    });

    if (!survey.resultsVisible && retro.phase === 'completed') {
        return null;
    }

    if (!survey.resultsVisible) {
        return (
            <p
                data-slot="survey-discussion"
                className="flex min-w-0 items-start gap-1.5 border-t border-border pt-3 text-xs/snug text-muted-foreground"
            >
                <MessageSquare
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden
                />
                <span className="min-w-0">
                    <span className="sr-only">{commentsLabel} · </span>
                    <span aria-hidden="true">{survey.commentCount} · </span>
                    {t('Answer to join the discussion')}
                </span>
            </p>
        );
    }

    const refresh = async () => {
        const fresh = await ctx.run(fetchSurvey(retro.id, survey.id));

        if (fresh) {
            ctx.apply({ type: 'survey.upsert', survey: fresh });
        }
    };

    const toggleReaction = async (emoji: string) => {
        const removing =
            survey.reactions.find((reaction) => reaction.emoji === emoji)
                ?.mine === true;

        ctx.dispatch({
            type: 'survey.upsert',
            survey: {
                ...survey,
                reactions: optimisticReactions(
                    survey.reactions,
                    emoji,
                    removing,
                ),
            },
        });

        const response = await ctx.run(
            retroRequest<{ survey: SurveyPayload }>(
                removing
                    ? SurveyReactionsController.destroy(route)
                    : SurveyReactionsController.update(route),
                { emoji },
            ),
        );

        if (response) {
            ctx.invalidateSurvey(response.survey.id);
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const actions: CommentThreadActions<SurveyComment> = {
        create: async (content, parentCommentId) => {
            const response = await ctx.run(
                retroRequest<{ comment: SurveyComment }>(
                    SurveyCommentsController.store(route),
                    { content, parentCommentId },
                ),
            );

            if (!response) {
                return false;
            }

            void refresh();

            return true;
        },
        update: async (comment, content) => {
            const response = await ctx.run(
                retroRequest<{ comment: SurveyComment }>(
                    SurveyCommentsController.update({
                        retro: retro.id,
                        surveyComment: comment.id,
                    }),
                    { content },
                ),
            );

            if (!response) {
                return false;
            }

            void refresh();

            return true;
        },
        remove: async (comment) => {
            const result = await ctx.run(
                retroRequest(
                    SurveyCommentsController.destroy({
                        retro: retro.id,
                        surveyComment: comment.id,
                    }),
                ),
            );

            if (result !== undefined) {
                await refresh();
            }
        },
    };

    return (
        <div
            data-slot="survey-discussion"
            className="flex min-w-0 flex-col gap-2 border-t border-border pt-3"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {retro.reactionsEnabled && (
                    <ReactionChips
                        reactions={survey.reactions}
                        canReact={canDiscuss}
                        onToggle={(emoji) => void toggleReaction(emoji)}
                    />
                )}
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    data-slot="survey-comments-toggle"
                    className="ms-auto shrink-0 gap-1.5 text-muted-foreground tabular-nums"
                    aria-expanded={open}
                    aria-controls={open ? threadsId : undefined}
                    aria-label={commentsLabel}
                    onClick={() => setOpen(!open)}
                >
                    <MessageSquare aria-hidden />
                    {survey.commentCount}
                </Button>
            </div>
            {open && (
                <div id={threadsId} className="min-w-0">
                    <CommentThreadList
                        threads={survey.comments}
                        canWrite={canDiscuss}
                        actions={actions}
                        composerNote={
                            !survey.showVoters && !retro.isAnonymous
                                ? t('Your name is shown with your comment.')
                                : undefined
                        }
                    />
                </div>
            )}
        </div>
    );
}
