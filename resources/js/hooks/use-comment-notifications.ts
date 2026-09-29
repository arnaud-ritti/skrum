import { useCallback, useState } from 'react';

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

/**
 * Cards with a comment notification the viewer has not opened yet. Read
 * marks survive reloads per browser; unread state itself comes only from
 * live notifications, so nothing is replayed from before the page loaded.
 */
export function useCommentNotifications(retroId: string) {
    const [notifiedAt, setNotifiedAt] = useState<Record<string, string>>({});
    const [readAt, setReadAt] = useState<Record<string, string>>(() =>
        typeof window === 'undefined' ? {} : readMarks(retroId),
    );

    const notify = useCallback((cardId: string) => {
        setNotifiedAt((current) => ({
            ...current,
            [cardId]: new Date().toISOString(),
        }));
    }, []);

    const markRead = useCallback(
        (cardId: string) => {
            const next = {
                ...readMarks(retroId),
                [cardId]: new Date().toISOString(),
            };

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

    const unreadCardIds = new Set(
        Object.entries(notifiedAt)
            .filter(([cardId, at]) => (readAt[cardId] ?? '') < at)
            .map(([cardId]) => cardId),
    );

    return { unreadCardIds, notify, markRead };
}
