import { useCallback, useMemo, useRef, useState } from 'react';
import type { BoardCard, CardComment } from '@/lib/retro/types';

const storageKey = (retroId: string) => `skrum.readComments.${retroId}`;

function readMarks(retroId: string): Record<string, string> {
    try {
        return JSON.parse(
            window.localStorage.getItem(storageKey(retroId)) ?? '{}',
        ) as Record<string, string>;
    } catch {
        return {};
    }
}

function commentsOf(card: BoardCard): CardComment[] {
    return card.comments.flatMap((thread) => [thread, ...thread.replies]);
}

function newestCommentAt(card: BoardCard): string | null {
    return commentsOf(card).reduce<string | null>(
        (newest, comment) =>
            newest === null || isLater(comment.createdAt, newest)
                ? comment.createdAt
                : newest,
        null,
    );
}

function isLater(at: string, than: string | undefined): boolean {
    if (than === undefined) {
        return true;
    }

    return Date.parse(at) > Date.parse(than);
}

function isRecipient(card: BoardCard): boolean {
    return card.isMine || commentsOf(card).some((comment) => comment.isMine);
}

function hasUnread(card: BoardCard, readAt: string | undefined): boolean {
    if (!isRecipient(card)) {
        return false;
    }

    return commentsOf(card).some(
        (comment) =>
            !comment.isMine &&
            !comment.deleted &&
            isLater(comment.createdAt, readAt),
    );
}

/**
 * Cards with comments the viewer has not opened yet. Unread state is
 * derived from the board, compared with the newest comment time stored
 * per card when its thread was opened, so it survives reloads. Live
 * notifications mark a card too, in case the comment itself is not on
 * the board yet.
 */
export function useCommentNotifications(retroId: string, cards: BoardCard[]) {
    const [notifiedCardIds, setNotifiedCardIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [readAt, setReadAt] = useState<Record<string, string>>(() =>
        typeof window === 'undefined' ? {} : readMarks(retroId),
    );
    const latestCards = useRef(cards);
    const latestReadAt = useRef(readAt);

    latestCards.current = cards;
    latestReadAt.current = readAt;

    const notify = useCallback((cardId: string) => {
        setNotifiedCardIds((current) => new Set(current).add(cardId));
    }, []);

    const markRead = useCallback(
        (cardId: string) => {
            setNotifiedCardIds((current) => {
                if (!current.has(cardId)) {
                    return current;
                }

                const next = new Set(current);

                next.delete(cardId);

                return next;
            });

            const card = latestCards.current.find(
                (candidate) => candidate.id === cardId,
            );
            const newest = card ? newestCommentAt(card) : null;
            const marks = { ...latestReadAt.current, ...readMarks(retroId) };

            if (newest === null || !isLater(newest, marks[cardId])) {
                return;
            }

            const next = { ...marks, [cardId]: newest };

            try {
                window.localStorage.setItem(
                    storageKey(retroId),
                    JSON.stringify(next),
                );
            } catch {
                // Storage can be full or disabled; the dot then clears for this page only.
            }

            setReadAt(next);
        },
        [retroId],
    );

    const unreadCardIds = useMemo(
        () =>
            new Set([
                ...notifiedCardIds,
                ...cards
                    .filter((card) => hasUnread(card, readAt[card.id]))
                    .map((card) => card.id),
            ]),
        [cards, notifiedCardIds, readAt],
    );

    return { unreadCardIds, notify, markRead };
}
