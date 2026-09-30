import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import CardCommentsController from '@/actions/App/Http/Controllers/Retros/CardCommentsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardComment } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { CommentThreadList, type CommentThreadActions } from './comment-thread';
import { dragIsolation } from './dnd';

const CommentPhases = ['grouping', 'voting', 'discussing'];

export function CardComments({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const phase = ctx.board.retro.phase;
    const isUnread = ctx.unreadCardIds.has(card.id);
    const { markCommentsRead } = ctx;

    useEffect(() => {
        if (open && isUnread) {
            markCommentsRead(card.id);
        }
    }, [open, isUnread, card.id, markCommentsRead]);

    if (card.hidden || (phase === 'writing' && card.commentCount === 0)) {
        return null;
    }

    return (
        <div {...dragIsolation} className="mt-2">
            <Button
                size="sm"
                variant="ghost"
                className="relative h-7 gap-1"
                aria-expanded={open}
                aria-label={t('Comments (:count)', {
                    count: card.commentCount,
                })}
                onClick={() => setOpen(!open)}
            >
                <MessageSquare className="size-3.5" />
                {card.commentCount}
                {isUnread && (
                    <span
                        role="img"
                        className="absolute top-1 right-1 size-2 rounded-full bg-primary"
                        aria-label={t('Unread comments')}
                    />
                )}
            </Button>
            {open && <CardThread card={card} />}
        </div>
    );
}

function CardThread({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const retroId = ctx.board.retro.id;
    const canWrite =
        ctx.isEditable && CommentPhases.includes(ctx.board.retro.phase);

    const save = async (
        request: Promise<{ comment: CardComment }>,
    ): Promise<boolean> => {
        const response = await ctx.run(request);

        if (!response) {
            return false;
        }

        ctx.apply({ type: 'comment.upsert', comment: response.comment });

        return true;
    };

    const actions: CommentThreadActions<CardComment> = {
        create: (content, parentCommentId) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.store({
                        retro: retroId,
                        card: card.id,
                    }),
                    { content, parentCommentId },
                ),
            ),
        update: (comment, content) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.update({
                        retro: retroId,
                        comment: comment.id,
                    }),
                    { content },
                ),
            ),
        remove: async (comment, hasReplies) => {
            const result = await ctx.run(
                retroRequest(
                    CardCommentsController.destroy({
                        retro: retroId,
                        comment: comment.id,
                    }),
                ),
            );

            if (result === undefined) {
                return;
            }

            ctx.apply({
                type: 'comment.remove',
                cardId: comment.cardId,
                commentId: comment.id,
                soft: comment.parentCommentId === null && hasReplies,
            });

            if (comment.parentCommentId === null) {
                return;
            }

            const thread = card.comments.find(
                (candidate) => candidate.id === comment.parentCommentId,
            );

            if (thread?.deleted && thread.replies.length === 1) {
                ctx.apply({
                    type: 'comment.remove',
                    cardId: comment.cardId,
                    commentId: thread.id,
                    soft: false,
                });
            }
        },
    };

    return (
        <CommentThreadList
            threads={card.comments}
            canWrite={canWrite}
            actions={actions}
        />
    );
}
