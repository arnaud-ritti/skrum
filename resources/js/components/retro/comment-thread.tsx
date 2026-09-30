import { Pencil, Reply, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

export function CommentThreadList<T extends ThreadComment>({
    threads,
    canWrite,
    actions,
    composerNote,
}: Props<T>) {
    const { t } = useTrans();

    return (
        <div className="mt-2 space-y-3 border-l pl-3">
            {threads.map((thread) => (
                <ThreadItem
                    key={thread.id}
                    thread={thread}
                    canWrite={canWrite}
                    actions={actions}
                />
            ))}
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
        <div className="space-y-2">
            <CommentItem
                comment={thread}
                canWrite={canWrite}
                hasReplies={thread.replies.length > 0}
                actions={actions}
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
                            actions={actions}
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
                        actions={actions}
                        target={{ parentCommentId: thread.id }}
                        placeholder={t('Write a reply…')}
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

type FormTarget<T> = { parentCommentId: string | null } | { comment: T };

function CommentForm<T extends ThreadComment>({
    actions,
    target,
    placeholder,
    onDone,
}: {
    actions: CommentThreadActions<T>;
    target: FormTarget<T>;
    placeholder: string;
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
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
