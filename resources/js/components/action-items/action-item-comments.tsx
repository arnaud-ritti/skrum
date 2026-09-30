import { usePage } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import {
    canDeleteActionItemComment,
    type ActionItemViewer,
} from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem, ActionItemComment } from '@/lib/retro/types';
import { AnonymousNotice } from './anonymous-notice';
import type { RunMutation } from './action-item-card';

type Props = {
    id?: string;
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    viewer: ActionItemViewer;
    canWrite: boolean;
    showAnonymousNotice?: boolean;
    run: RunMutation;
    onCountChange: (count: number) => void;
};

export function ActionItemComments({
    id,
    item,
    endpoints,
    viewer,
    canWrite,
    showAnonymousNotice,
    run,
    onCountChange,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [comments, setComments] = useState<ActionItemComment[] | null>(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const latest = useRef({ endpoints, run });
    const revision = item.commentsRevision ?? 0;

    latest.current = { endpoints, run };

    useEffect(() => {
        let cancelled = false;

        void latest.current
            .run(
                retroRequest<{ comments: ActionItemComment[] }>(
                    latest.current.endpoints.comments(item.id),
                ),
            )
            .then((response) => {
                if (cancelled) {
                    return;
                }

                if (!response) {
                    setFailed(true);

                    return;
                }

                setFailed(false);
                setComments(response.comments);
            });

        return () => {
            cancelled = true;
        };
    }, [item.id, revision, attempt]);

    const add = async () => {
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

            const next = [...comments, response.comment];

            setComments(next);
            setDraft('');
            onCountChange(next.length);
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
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

    const remove = async (comment: ActionItemComment) => {
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

            const next = (comments ?? []).filter(
                (existing) => existing.id !== comment.id,
            );

            setComments(next);
            onCountChange(next.length);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div id={id} className="space-y-2 border-l pl-3">
            {comments === null && !failed && (
                <p className="text-xs text-muted-foreground">{t('Loading…')}</p>
            )}
            {comments === null && failed && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('Could not load the comments.')}</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => {
                            setFailed(false);
                            setAttempt(attempt + 1);
                        }}
                    >
                        {t('Retry')}
                    </Button>
                </div>
            )}
            {comments?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t('No comments yet.')}
                </p>
            )}
            <ul className="space-y-2">
                {comments?.map((comment) => (
                    <li key={comment.id} className="text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                                {comment.author?.name ?? t('Former member')}
                            </span>
                            {comment.createdAt && (
                                <time dateTime={comment.createdAt}>
                                    {formatShortDate(comment.createdAt, locale)}
                                </time>
                            )}
                            {canWrite && comment.isMine && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label={t('Edit comment')}
                                    onClick={() =>
                                        setEditing({
                                            id: comment.id,
                                            content: comment.content,
                                        })
                                    }
                                >
                                    <Pencil className="size-3" />
                                </Button>
                            )}
                            {canWrite &&
                                canDeleteActionItemComment(
                                    comment,
                                    item,
                                    viewer,
                                ) && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-6"
                                        disabled={busy}
                                        aria-label={t('Delete comment')}
                                        onClick={() => void remove(comment)}
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                )}
                        </div>
                        {editing?.id === comment.id ? (
                            <form
                                className="mt-1 space-y-1"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void save();
                                }}
                            >
                                <Textarea
                                    value={editing.content}
                                    maxLength={500}
                                    rows={2}
                                    aria-label={t('Edit comment')}
                                    onChange={(event) =>
                                        setEditing({
                                            id: comment.id,
                                            content: event.target.value,
                                        })
                                    }
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={busy}
                                    >
                                        {t('Save')}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditing(null)}
                                    >
                                        {t('Cancel')}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <p className="break-words whitespace-pre-wrap">
                                {comment.content}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
            {canWrite && (
                <form
                    className="space-y-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    {showAnonymousNotice && <AnonymousNotice />}
                    <Textarea
                        value={draft}
                        maxLength={500}
                        rows={2}
                        placeholder={t('Write a comment…')}
                        aria-label={t('Write a comment…')}
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        disabled={
                            busy || comments === null || draft.trim() === ''
                        }
                    >
                        {t('Comment')}
                    </Button>
                </form>
            )}
        </div>
    );
}
