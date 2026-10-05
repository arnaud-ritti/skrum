import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import { patchToPayload } from '@/components/action-items/action-item-adapters';
import type { ActionItemPatch } from '@/components/skrum/action-item';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';
import type { ActionItem, ActionItemStatus } from '@/lib/retro/types';

/** Resolves to `undefined` when the request failed and was reported. */
export type RunMutation = <T>(request: Promise<T>) => Promise<T | undefined>;

type ActionItemMutationOptions = {
    /** Replaces the toast-and-resync `run`: the board has its own. */
    run?: RunMutation;
    /** Reloads what the screen shows after a failed request. */
    resync?: () => void;
    onRemoved?: (actionItemId: string) => void;
    onCommentCount?: (actionItemId: string, commentCount: number) => void;
};

/** What `ItemSubtasks`, `ItemComments` and `ItemExport` read from their container. */
export type ActionItemMutationsValue = {
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    onSaved: (item: ActionItem) => void;
    onCommentCount?: (actionItemId: string, commentCount: number) => void;
};

export const ActionItemMutationsContext =
    createContext<ActionItemMutationsValue | null>(null);

export function useActionItemMutationsValue(): ActionItemMutationsValue {
    const value = useContext(ActionItemMutationsContext);

    if (value === null) {
        throw new Error(
            'An action item container needs an ActionItemMutationsContext.',
        );
    }

    return value;
}

export function useActionItemMutations(
    endpoints: ActionItemEndpoints,
    onSaved: (item: ActionItem) => void,
    options: ActionItemMutationOptions = {},
) {
    const { t } = useTrans();
    const [busyId, setBusyId] = useState<string | null>(null);
    const busyIds = useRef(new Set<string>());
    const latest = useRef({ onSaved, options });

    useEffect(() => {
        latest.current = { onSaved, options };
    });

    const run = useCallback<RunMutation>(
        async (request) => {
            const { run: containerRun, resync } = latest.current.options;

            if (containerRun) {
                return containerRun(request);
            }

            try {
                return await request;
            } catch (error) {
                const timedOut =
                    error instanceof RetroRequestError && error.status === 0;
                const serverMessage =
                    error instanceof RetroRequestError && error.message !== ''
                        ? error.message
                        : t('Something went wrong. Please try again.');

                toast.error(
                    timedOut
                        ? t(
                              'The server did not respond in time. Please try again.',
                          )
                        : serverMessage,
                );
                resync?.();

                return undefined;
            }
        },
        [t],
    );

    const whileBusy = useCallback(
        async (item: ActionItem, request: () => Promise<void>) => {
            if (busyIds.current.has(item.id)) {
                return;
            }

            busyIds.current.add(item.id);
            setBusyId(item.id);

            try {
                await request();
            } finally {
                busyIds.current.delete(item.id);
                setBusyId((current) => (current === item.id ? null : current));
            }
        },
        [],
    );

    const update = useCallback(
        async (item: ActionItem, payload: Record<string, unknown>) => {
            if (Object.keys(payload).length === 0) {
                return;
            }

            await whileBusy(item, async () => {
                const response = await run(
                    retroRequest<{ actionItem: ActionItem }>(
                        endpoints.update(item.id),
                        payload,
                    ),
                );

                if (response) {
                    latest.current.onSaved(response.actionItem);
                }
            });
        },
        [endpoints, run, whileBusy],
    );

    const patch = useCallback(
        (item: ActionItem, changes: ActionItemPatch) =>
            update(item, patchToPayload(changes, item)),
        [update],
    );

    const setStatus = useCallback(
        (item: ActionItem, status: ActionItemStatus) =>
            update(item, { status }),
        [update],
    );

    const remove = useCallback(
        (item: ActionItem) =>
            whileBusy(item, async () => {
                const result = await run(
                    retroRequest(endpoints.destroy(item.id)),
                );

                if (result !== undefined) {
                    latest.current.options.onRemoved?.(item.id);
                }
            }),
        [endpoints, run, whileBusy],
    );

    const retrySync = useCallback(
        (item: ActionItem, link: { id: string }) =>
            whileBusy(item, async () => {
                const response = await run(
                    retroRequest<{ actionItem: ActionItem }>(
                        endpoints.syncLink(item.id, link.id),
                    ),
                );

                if (response) {
                    latest.current.onSaved(response.actionItem);
                    toast.success(t('Sync requested.'));
                }
            }),
        [endpoints, run, t, whileBusy],
    );

    const value = useMemo<ActionItemMutationsValue>(
        () => ({
            endpoints,
            run,
            onSaved: (item) => latest.current.onSaved(item),
            onCommentCount: (actionItemId, commentCount) =>
                latest.current.options.onCommentCount?.(
                    actionItemId,
                    commentCount,
                ),
        }),
        [endpoints, run],
    );

    return { busyId, patch, setStatus, remove, retrySync, run, value };
}
