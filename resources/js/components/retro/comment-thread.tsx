import { CornerDownRight, Pencil, Trash2, VenetianMask } from 'lucide-react';
import { useRef, useState } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { Person } from '@/lib/retro/types';
import { useBoard } from './board-context';

export type ThreadComment = {
    id: string;
    parentCommentId: string | null;
    isMine: boolean;
    deleted: boolean;
    content: string | null;
    author: Person | null;
    createdAt: string;
};

export type ThreadWithReplies<T extends ThreadComment> = T & { replies: T[] };

export type CommentThreadActions<T extends ThreadComment> = {
    create: (
        content: string,
        parentCommentId: string | null,
    ) => Promise<boolean>;
    update: (comment: T, content: string) => Promise<boolean>;
    remove: (comment: T, hasReplies: boolean) => Promise<void>;
};

type Props<T extends ThreadComment> = {
    threads: ThreadWithReplies<T>[];
    canWrite: boolean;
    actions: CommentThreadActions<T>;
    composerNote?: string;
};

export const CommentMaxLength = 500;

const iconButtonClass =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * The comments of a card or of a survey: threads one level deep, a field to
 * comment and, on each thread, a field to reply.
 */
export function CommentThreadList<T extends ThreadComment>({
    threads,
    canWrite,
    actions,
    composerNote,
}: Props<T>) {
    const { t } = useTrans();

    return (
        <div
            data-slot="comment-threads"
            className="flex min-w-0 flex-col gap-3 border-t border-border pt-3"
        >
            {threads.map((thread) => (
                <ThreadItem
                    key={thread.id}
                    thread={thread}
                    canWrite={canWrite}
                    actions={actions}
                />
            ))}
            {!canWrite && threads.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t('No comments yet.')}
                </p>
            )}
            {canWrite && composerNote && (
                <p className="text-xs text-muted-foreground">{composerNote}</p>
            )}
            {canWrite && (
                <CommentForm
                    actions={actions}
                    target={{ parentCommentId: null }}
                    placeholder={t('Write a comment…')}
                />
            )}
        </div>
    );
}

function ThreadItem<T extends ThreadComment>({
    thread,
    canWrite,
    actions,
}: {
    thread: ThreadWithReplies<T>;
    canWrite: boolean;
    actions: CommentThreadActions<T>;
}) {
    const { t } = useTrans();
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);

    return (
        <div data-slot="comment-thread" className="flex min-w-0 flex-col gap-2">
            <CommentItem
                comment={thread}
                canWrite={canWrite}
                hasReplies={thread.replies.length > 0}
                actions={actions}
            />
            {thread.replies.length > 0 && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                    className="max-w-full self-start truncate rounded-sm text-xs font-semibold text-skrum-primary-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {thread.replies.length === 1
                        ? t('1 reply')
                        : t(':count replies', { count: thread.replies.length })}
                </button>
            )}
            {expanded && (
                <div className="flex min-w-0 flex-col gap-2 border-l-2 border-border pl-3">
                    {thread.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            canWrite={canWrite}
                            hasReplies={false}
                            actions={actions}
                        />
                    ))}
                </div>
            )}
            {canWrite && !replying && !thread.deleted && (
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="max-w-full self-start"
                    onClick={() => {
                        setReplying(true);
                        setExpanded(true);
                    }}
                >
                    <CornerDownRight aria-hidden />
                    <span className="truncate">{t('Reply')}</span>
                </Button>
            )}
            {replying && (
                <div className="border-l-2 border-border pl-3">
                    <CommentForm
                        actions={actions}
                        target={{ parentCommentId: thread.id }}
                        placeholder={t('Write a reply…')}
                        autoFocus
                        onDone={() => setReplying(false)}
                    />
                </div>
            )}
        </div>
    );
}

function CommentItem<T extends ThreadComment>({
    comment,
    canWrite,
    hasReplies,
    actions,
}: {
    comment: T;
    canWrite: boolean;
    hasReplies: boolean;
    actions: CommentThreadActions<T>;
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

        await actions.remove(comment, hasReplies).finally(() => {
            removeInFlight.current = false;
            setRemoving(false);
        });
    };

    if (editing) {
        return (
            <CommentForm
                actions={actions}
                target={{ comment }}
                placeholder={t('Edit comment')}
                autoFocus
                onDone={() => setEditing(false)}
            />
        );
    }

    const { author } = comment;
    const avatarUrl = author
        ? ctx.board.participants.find(
              (participant) => participant.id === author.id,
          )?.avatarUrl
        : null;

    return (
        <div data-slot="comment" className="flex min-w-0 items-start gap-2">
            {author ? (
                <PersonAvatar
                    name={author.name}
                    src={avatarUrl}
                    size="xs"
                    decorative
                />
            ) : (
                <VenetianMask
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
            )}
            <div className="min-w-0 flex-1 text-xs">
                <p className="truncate font-semibold">
                    {author?.name ?? t('Anonymous')}
                </p>
                <p className="break-words whitespace-pre-wrap">
                    {comment.content}
                </p>
            </div>
            {(canEdit || canDelete) && (
                <div className="flex shrink-0 items-center">
                    {canEdit && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t('Edit comment')}
                                    onClick={() => setEditing(true)}
                                    className={iconButtonClass}
                                >
                                    <Pencil className="size-4" aria-hidden />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Edit comment')}</TooltipContent>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t('Delete comment')}
                                    disabled={removing}
                                    onClick={() => void remove()}
                                    className={`${iconButtonClass} hover:text-skrum-destructive-text`}
                                >
                                    <Trash2 className="size-4" aria-hidden />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {t('Delete comment')}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}
        </div>
    );
}

type FormTarget<T> = { parentCommentId: string | null } | { comment: T };

function CommentForm<T extends ThreadComment>({
    actions,
    target,
    placeholder,
    autoFocus = false,
    onDone,
}: {
    actions: CommentThreadActions<T>;
    target: FormTarget<T>;
    placeholder: string;
    autoFocus?: boolean;
    onDone?: () => void;
}) {
    const { t } = useTrans();
    const editedComment = 'comment' in target ? target.comment : null;
    const [content, setContent] = useState(editedComment?.content ?? '');
    const [sending, setSending] = useState(false);
    const sendInFlight = useRef(false);
    const submitLabel = editedComment
        ? t('Save')
        : 'parentCommentId' in target && target.parentCommentId === null
          ? t('Comment')
          : t('Reply');

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sendInFlight.current) {
            return;
        }

        sendInFlight.current = true;
        setSending(true);

        const saved = await (
            'comment' in target
                ? actions.update(target.comment, trimmed)
                : actions.create(trimmed, target.parentCommentId)
        ).finally(() => {
            sendInFlight.current = false;
            setSending(false);
        });

        if (!saved) {
            return;
        }

        setContent('');
        onDone?.();
    };

    return (
        <form
            data-slot="comment-form"
            className="flex min-w-0 flex-col gap-1.5"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Textarea
                value={content}
                maxLength={CommentMaxLength}
                rows={2}
                autoFocus={autoFocus}
                placeholder={placeholder}
                aria-label={placeholder}
                className="min-h-14 text-xs"
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                    ) {
                        event.preventDefault();
                        void submit();
                    }

                    if (event.key === 'Escape' && onDone) {
                        event.preventDefault();
                        event.stopPropagation();
                        onDone();
                    }
                }}
            />
            <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                {onDone && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="max-w-full"
                        onClick={onDone}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                )}
                <Button
                    type="submit"
                    size="sm"
                    className="max-w-full"
                    disabled={sending || content.trim() === ''}
                >
                    <span className="truncate">{submitLabel}</span>
                </Button>
            </div>
        </form>
    );
}
