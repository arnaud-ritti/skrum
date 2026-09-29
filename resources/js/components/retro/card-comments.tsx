import { MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CardCommentsController from '@/actions/App/Http/Controllers/Retros/CardCommentsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardComment, CommentThread } from '@/lib/retro/types';
import { useBoard } from './board-context';
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
            {open && <Thread card={card} />}
        </div>
    );
}

function Thread({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const canWrite =
        ctx.isEditable && CommentPhases.includes(ctx.board.retro.phase);

    return (
        <div className="mt-2 space-y-3 border-l pl-3">
            {card.comments.map((thread) => (
                <ThreadItem
                    key={thread.id}
                    card={card}
                    thread={thread}
                    canWrite={canWrite}
                />
            ))}
            {canWrite && (
                <CommentForm
                    target={{ cardId: card.id, parentCommentId: null }}
                    placeholder={t('Write a comment…')}
                />
            )}
        </div>
    );
}

function ThreadItem({
    card,
    thread,
    canWrite,
}: {
    card: BoardCard;
    thread: CommentThread;
    canWrite: boolean;
}) {
    const { t } = useTrans();
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);

    return (
        <div className="space-y-2">
            <CommentItem
                comment={thread}
                canWrite={canWrite}
                hasReplies={thread.replies.length > 0}
            />
            {thread.replies.length > 0 && (
                <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                >
                    {thread.replies.length === 1
                        ? t('1 reply')
                        : t(':count replies', { count: thread.replies.length })}
                </Button>
            )}
            {expanded && (
                <div className="space-y-2 pl-4">
                    {thread.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            canWrite={canWrite}
                            hasReplies={false}
                        />
                    ))}
                </div>
            )}
            {canWrite && !replying && !thread.deleted && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs"
                    onClick={() => {
                        setReplying(true);
                        setExpanded(true);
                    }}
                >
                    <Reply className="size-3" />
                    {t('Reply')}
                </Button>
            )}
            {replying && (
                <div className="pl-4">
                    <CommentForm
                        target={{ cardId: card.id, parentCommentId: thread.id }}
                        placeholder={t('Write a reply…')}
                        onDone={() => setReplying(false)}
                    />
                </div>
            )}
        </div>
    );
}

function CommentItem({
    comment,
    canWrite,
    hasReplies,
}: {
    comment: CardComment;
    canWrite: boolean;
    hasReplies: boolean;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const removeInFlight = useRef(false);
    const canEdit = canWrite && comment.isMine;
    const canDelete =
        canWrite && (comment.isMine || ctx.board.viewer.isFacilitator);

    if (comment.deleted) {
        return (
            <p className="text-xs text-muted-foreground italic">
                {t('Comment deleted')}
            </p>
        );
    }

    const remove = async () => {
        if (removeInFlight.current) {
            return;
        }

        removeInFlight.current = true;
        setRemoving(true);

        const result = await ctx
            .run(
                retroRequest(
                    CardCommentsController.destroy({
                        retro: ctx.board.retro.id,
                        comment: comment.id,
                    }),
                ),
            )
            .finally(() => {
                removeInFlight.current = false;
                setRemoving(false);
            });

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

        const card = ctx.board.cards.find((c) => c.id === comment.cardId);
        const thread = card?.comments.find(
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
    };

    if (editing) {
        return (
            <CommentForm
                target={{ comment }}
                placeholder={t('Edit comment')}
                onDone={() => setEditing(false)}
            />
        );
    }

    return (
        <div className="text-xs">
            <p className="font-medium">
                {comment.author?.name ?? t('Anonymous')}
            </p>
            <p className="break-words whitespace-pre-wrap">{comment.content}</p>
            {(canEdit || canDelete) && (
                <div className="mt-1 flex gap-1">
                    {canEdit && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Edit comment')}
                            onClick={() => setEditing(true)}
                        >
                            <Pencil className="size-3" />
                        </Button>
                    )}
                    {canDelete && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Delete comment')}
                            disabled={removing}
                            onClick={() => void remove()}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

type FormTarget =
    | { cardId: string; parentCommentId: string | null }
    | { comment: CardComment };

function CommentForm({
    target,
    placeholder,
    onDone,
}: {
    target: FormTarget;
    placeholder: string;
    onDone?: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const editedComment = 'comment' in target ? target.comment : null;
    const [content, setContent] = useState(editedComment?.content ?? '');
    const [sending, setSending] = useState(false);
    const sendInFlight = useRef(false);

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sendInFlight.current) {
            return;
        }

        sendInFlight.current = true;
        setSending(true);

        const retro = ctx.board.retro.id;
        const request =
            'comment' in target
                ? retroRequest<{ comment: CardComment }>(
                      CardCommentsController.update({
                          retro,
                          comment: target.comment.id,
                      }),
                      { content: trimmed },
                  )
                : retroRequest<{ comment: CardComment }>(
                      CardCommentsController.store({
                          retro,
                          card: target.cardId,
                      }),
                      {
                          content: trimmed,
                          parentCommentId: target.parentCommentId,
                      },
                  );

        const response = await ctx.run(request).finally(() => {
            sendInFlight.current = false;
            setSending(false);
        });

        if (!response) {
            return;
        }

        ctx.apply({ type: 'comment.upsert', comment: response.comment });
        setContent('');
        onDone?.();
    };

    return (
        <form
            className="space-y-1"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Textarea
                value={content}
                maxLength={500}
                rows={2}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="flex justify-end gap-1">
                {onDone && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onDone}
                    >
                        {t('Cancel')}
                    </Button>
                )}
                <Button size="sm" disabled={sending || content.trim() === ''}>
                    {editedComment ? t('Save') : t('Reply')}
                </Button>
            </div>
        </form>
    );
}
