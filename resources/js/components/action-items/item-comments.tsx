import { usePage } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import {
    AnonymousNote,
    useInlineEscape,
} from '@/components/action-items/item-parts';
import { useActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import { canDeleteActionItemComment } from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem, ActionItemComment } from '@/lib/retro/types';

const CommentMaxLength = 500;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    /** Bumped by a comment event of someone else: the thread loads again. */
    revision: number;
    viewer: ActionItemViewer;
    /** False on a board that no longer takes changes. */
    canWrite?: boolean;
    showAnonymousNotice?: boolean;
};

function submitsOnShortcut(
    event: KeyboardEvent<HTMLTextAreaElement>,
    submit: () => void,
): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        submit();
    }
}

export function ItemComments({
    item,
    endpoints,
    revision,
    viewer,
    canWrite = true,
    showAnonymousNotice = false,
}: Props): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { run, onCommentCount } = useActionItemMutationsValue();
    const [comments, setComments] = useState<ActionItemComment[] | null>(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const editor = useRef<HTMLFormElement>(null);
    const latest = useRef({ endpoints, comments });

    useEffect(() => {
        latest.current = { endpoints, comments };
    });

    useInlineEscape(editor, editing !== null, () => setEditing(null));

    useEffect(() => {
        let cancelled = false;

        void retroRequest<{ comments: ActionItemComment[] }>(
            latest.current.endpoints.comments(item.id),
        ).then(
            (response) => {
                if (cancelled) {
                    return;
                }

                setFailed(false);
                setComments(response.comments);
            },
            () => {
                if (!cancelled) {
                    setFailed(true);
                }
            },
        );

        return () => {
            cancelled = true;
        };
    }, [item.id, revision, attempt]);

    const add = async (): Promise<void> => {
        const content = draft.trim();

        if (content === '' || busy || comments === null) {
            return;
        }

        setBusy(true);

        try {
            const response = await run(
                retroRequest<{ comment: ActionItemComment }>(
                    endpoints.addComment(item.id),
                    { content },
                ),
            );

            if (!response) {
                return;
            }

            const current = latest.current.comments ?? [];
            const next = current.some(
                (existing) => existing.id === response.comment.id,
            )
                ? current
                : [...current, response.comment];

            setComments(next);
            setDraft('');
            onCommentCount?.(item.id, next.length);
        } finally {
            setBusy(false);
        }
    };

    const save = async (): Promise<void> => {
        const content = editing?.content.trim() ?? '';

        if (editing === null || content === '' || busy) {
            return;
        }

        setBusy(true);

        try {
            const response = await run(
                retroRequest<{ comment: ActionItemComment }>(
                    endpoints.updateComment(editing.id),
                    { content },
                ),
            );

            if (!response) {
                return;
            }

            setComments((current) =>
                (current ?? []).map((comment) =>
                    comment.id === response.comment.id
                        ? response.comment
                        : comment,
                ),
            );
            setEditing(null);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (comment: ActionItemComment): Promise<void> => {
        if (busy) {
            return;
        }

        setBusy(true);

        try {
            const result = await run(
                retroRequest(endpoints.destroyComment(comment.id)),
            );

            if (result === undefined) {
                return;
            }

            const next = (latest.current.comments ?? []).filter(
                (existing) => existing.id !== comment.id,
            );

            setComments(next);
            onCommentCount?.(item.id, next.length);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div data-slot="item-comments" className="flex min-w-0 flex-col gap-3">
            {comments === null && !failed && (
                <div role="status" className="flex flex-col gap-2">
                    <span className="sr-only">{t('Loading…')}</span>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            )}
            {comments === null && failed && (
                <Alert
                    variant="error"
                    title={t('Could not load the comments.')}
                    action={
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="max-w-full min-w-0"
                            onClick={() => {
                                setFailed(false);
                                setAttempt(attempt + 1);
                            }}
                        >
                            <span className="truncate">{t('Retry')}</span>
                        </Button>
                    }
                />
            )}
            {comments?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t('No comments yet.')}
                </p>
            )}
            {comments !== null && comments.length > 0 && (
                <ul className="flex min-w-0 flex-col gap-3">
                    {comments.map((comment) => {
                        const authorName =
                            comment.author?.name ?? t('Former member');
                        const canEdit = canWrite && comment.isMine;
                        const canDelete =
                            canWrite &&
                            canDeleteActionItemComment(comment, item, viewer);

                        return (
                            <li
                                key={comment.id}
                                data-slot="item-comment"
                                className="flex min-w-0 items-start gap-2"
                            >
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={authorName}
                                    src={comment.author?.avatarUrl}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                                        <span className="min-w-0 truncate font-semibold text-foreground">
                                            {authorName}
                                        </span>
                                        {comment.createdAt && (
                                            <time
                                                dateTime={comment.createdAt}
                                                className="shrink-0"
                                            >
                                                {formatShortDate(
                                                    comment.createdAt,
                                                    locale,
                                                )}
                                            </time>
                                        )}
                                    </p>
                                    {editing?.id === comment.id ? (
                                        <form
                                            ref={editor}
                                            className="flex min-w-0 flex-col gap-2"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                void save();
                                            }}
                                        >
                                            <Textarea
                                                autoFocus
                                                value={editing.content}
                                                maxLength={CommentMaxLength}
                                                rows={2}
                                                aria-label={t('Edit comment')}
                                                onChange={(event) =>
                                                    setEditing({
                                                        id: comment.id,
                                                        content:
                                                            event.target.value,
                                                    })
                                                }
                                                onKeyDown={(event) =>
                                                    submitsOnShortcut(
                                                        event,
                                                        () => void save(),
                                                    )
                                                }
                                            />
                                            <div className="flex min-w-0 flex-wrap gap-2">
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    className="max-w-full min-w-0"
                                                    disabled={
                                                        busy ||
                                                        editing.content.trim() ===
                                                            ''
                                                    }
                                                >
                                                    <span className="truncate">
                                                        {t('Save')}
                                                    </span>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="max-w-full min-w-0"
                                                    onClick={() =>
                                                        setEditing(null)
                                                    }
                                                >
                                                    <span className="truncate">
                                                        {t('Cancel')}
                                                    </span>
                                                </Button>
                                            </div>
                                        </form>
                                    ) : (
                                        <p className="break-words whitespace-pre-wrap">
                                            {comment.content}
                                        </p>
                                    )}
                                </div>
                                {(canEdit || canDelete) &&
                                    editing?.id !== comment.id && (
                                        <div className="flex shrink-0 items-center">
                                            {canEdit && (
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className="size-7"
                                                    aria-label={t(
                                                        'Edit comment',
                                                    )}
                                                    onClick={() =>
                                                        setEditing({
                                                            id: comment.id,
                                                            content:
                                                                comment.content,
                                                        })
                                                    }
                                                >
                                                    <Pencil aria-hidden />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className="size-7 hover:text-skrum-destructive-text"
                                                    disabled={busy}
                                                    aria-label={t(
                                                        'Delete comment',
                                                    )}
                                                    onClick={() =>
                                                        void remove(comment)
                                                    }
                                                >
                                                    <Trash2 aria-hidden />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {canWrite && (
                <form
                    className="flex min-w-0 flex-col gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    {showAnonymousNotice && <AnonymousNote />}
                    <Textarea
                        value={draft}
                        maxLength={CommentMaxLength}
                        rows={2}
                        placeholder={t('Write a comment…')}
                        aria-label={t('Write a comment…')}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) =>
                            submitsOnShortcut(event, () => void add())
                        }
                    />
                    <Button
                        type="submit"
                        size="sm"
                        className="max-w-full min-w-0 self-start"
                        disabled={
                            busy || comments === null || draft.trim() === ''
                        }
                    >
                        <span className="truncate">{t('Comment')}</span>
                    </Button>
                </form>
            )}
        </div>
    );
}
