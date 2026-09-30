import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import SurveyCommentsController from '@/actions/App/Http/Controllers/Retros/SurveyCommentsController';
import SurveyReactionsController from '@/actions/App/Http/Controllers/Retros/SurveyReactionsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { fetchSurvey, SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyComment, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { CommentThreadList, type CommentThreadActions } from './comment-thread';
import { optimisticReactions, ReactionChips } from './reaction-chips';

export function SurveyDiscussion({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
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

    if (!survey.resultsVisible) {
        return (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare
                    className="size-3.5"
                    aria-label={commentsLabel}
                />
                {survey.commentCount} · {t('Answer to join the discussion')}
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
        <div className="space-y-1">
            {retro.reactionsEnabled && (
                <ReactionChips
                    reactions={survey.reactions}
                    canReact={canDiscuss}
                    onToggle={(emoji) => void toggleReaction(emoji)}
                />
            )}
            <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                aria-expanded={open}
                aria-label={commentsLabel}
                onClick={() => setOpen(!open)}
            >
                <MessageSquare className="size-3.5" />
                {survey.commentCount}
            </Button>
            {open && (
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
            )}
        </div>
    );
}
