import { router } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeConnectionStatus } from '@/hooks/use-retro-channel';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import { countActionItemComments } from '@/lib/retro/board-reducer';
import type { ActionItem } from '@/lib/retro/types';

const ReloadDelayMs = 1_000;

/** The list, its counters, and what the sidebar and the bell say of them. */
export const ReloadProps = [
    'items',
    'focusedItem',
    'counts',
    'actionItems',
    'notifications',
];

/**
 * A broadcast knows less than the page: it is sent to everyone, so it has
 * no `isMine`, no links to the trackers and no revision of the comments.
 */
export function replaceActionItem(
    items: ActionItem[],
    incoming: ActionItem,
): ActionItem[] {
    return items.map((item) =>
        item.id === incoming.id
            ? {
                  ...incoming,
                  isMine: incoming.isMine || item.isMine,
                  commentsRevision: item.commentsRevision,
                  externalLinks: incoming.externalLinks ?? item.externalLinks,
                  completedVia:
                      incoming.completedAt === null
                          ? null
                          : (incoming.completedVia ?? item.completedVia),
              }
            : item,
    );
}

export function reloadActionItems(): void {
    router.reload({ only: ReloadProps });
}

type Options = {
    items: ActionItem[];
    focusedItem: ActionItem | null;
    realtimeTeamIds: string[];
    /** An item changed, here or in another browser. */
    onSaved?: (item: ActionItem) => void;
    /** An item was deleted in another browser. */
    onDeleted?: (actionItemId: string) => void;
    onComments?: (
        actionItemId: string,
        commentCount: number,
        refresh: boolean,
    ) => void;
};

/**
 * The rows of the page, kept in step with the server: a change shows at
 * once, then one reload, a second later, puts the list, the counters and
 * the order right.
 */
export function useActionItemsRealtime({
    items,
    focusedItem,
    realtimeTeamIds,
    onSaved,
    onDeleted,
    onComments,
}: Options) {
    const [rows, setRows] = useState(items);
    const [knownRows, setKnownRows] = useState(items);
    const [focused, setFocused] = useState(focusedItem);
    const [knownFocused, setKnownFocused] = useState(focusedItem);
    const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
    const connectionStatus = useSafeConnectionStatus();
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);

    if (knownRows !== items) {
        setKnownRows(items);
        setRows(items);
    }

    if (knownFocused !== focusedItem) {
        setKnownFocused(focusedItem);
        setFocused(focusedItem);
    }

    const scheduleReload = useCallback(() => {
        if (pendingReload.current !== null) {
            return;
        }

        pendingReload.current = setTimeout(() => {
            pendingReload.current = null;
            reloadActionItems();
        }, ReloadDelayMs);
    }, []);

    const listeners = useRef({ onSaved, onDeleted, onComments });

    useEffect(() => {
        listeners.current = { onSaved, onDeleted, onComments };
    });

    const saveRow = useCallback(
        (incoming: ActionItem) => {
            setRows((current) => replaceActionItem(current, incoming));
            setFocused((current) =>
                current === null
                    ? null
                    : replaceActionItem([current], incoming)[0],
            );
            listeners.current.onSaved?.(incoming);
            scheduleReload();
        },
        [scheduleReload],
    );

    const removeRow = useCallback(
        (actionItemId: string) => {
            setRows((current) =>
                current.filter((row) => row.id !== actionItemId),
            );
            setFocused((current) =>
                current?.id === actionItemId ? null : current,
            );
            scheduleReload();
        },
        [scheduleReload],
    );

    const countComments = useCallback(
        (actionItemId: string, commentCount: number, refresh: boolean) => {
            setRows((current) =>
                countActionItemComments(
                    current,
                    actionItemId,
                    commentCount,
                    refresh,
                ),
            );
            setFocused((current) =>
                current === null
                    ? null
                    : countActionItemComments(
                          [current],
                          actionItemId,
                          commentCount,
                          refresh,
                      )[0],
            );
            listeners.current.onComments?.(actionItemId, commentCount, refresh);
        },
        [],
    );

    const handlers = useRef({ saveRow, countComments, scheduleReload });

    useEffect(() => {
        handlers.current = { saveRow, countComments, scheduleReload };
    });

    const channelKey = realtimeTeamIds.join(',');

    useEffect(() => {
        if (!echoIsConfigured() || channelKey === '') {
            return;
        }

        const names = channelKey
            .split(',')
            .map((teamId) => `team-action-items.${teamId}`);

        for (const name of names) {
            echo<'reverb'>()
                .private(name)
                .subscribed(() =>
                    setSubscribedChannels((current) =>
                        current.includes(name) ? current : [...current, name],
                    ),
                )
                .listen(
                    '.team-action-item.saved',
                    (payload: { actionItem: ActionItem }) =>
                        handlers.current.saveRow(payload.actionItem),
                )
                .listen(
                    '.team-action-item.deleted',
                    (payload: { actionItemId: string }) => {
                        listeners.current.onDeleted?.(payload.actionItemId);
                        handlers.current.scheduleReload();
                    },
                )
                .listen(
                    '.team-action-item.comments.changed',
                    (payload: { actionItemId: string; commentCount: number }) =>
                        handlers.current.countComments(
                            payload.actionItemId,
                            payload.commentCount,
                            true,
                        ),
                );
        }

        return () => {
            for (const name of names) {
                echo().leave(name);
            }

            setSubscribedChannels([]);
        };
    }, [channelKey]);

    useEffect(() => {
        window.addEventListener('focus', reloadActionItems);

        return () => {
            window.removeEventListener('focus', reloadActionItems);

            if (pendingReload.current !== null) {
                clearTimeout(pendingReload.current);
            }
        };
    }, []);

    const state: RealtimeState = realtimeState(
        connectionStatus === 'connected',
        subscribedChannels.length === realtimeTeamIds.length
            ? subscribedChannels
            : [],
    );

    return {
        rows,
        focused,
        state,
        saveRow,
        removeRow,
        countComments,
        scheduleReload,
    };
}
