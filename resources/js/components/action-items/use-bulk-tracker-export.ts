import { useRef, useState } from 'react';
import { exportTargetBody } from '@/components/action-items/export-target-fields';
import type { ExportTarget } from '@/components/action-items/export-target-fields';
import { ExportTimeoutMs } from '@/components/action-items/item-export';
import { useTrans } from '@/hooks/use-trans';
import type { BulkRefusal } from '@/lib/action-items/bulk';
import {
    BulkExportError,
    itemsToExport,
    runBulkExport,
} from '@/lib/action-items/bulk-export';
import type { BulkExportOutcome } from '@/lib/action-items/bulk-export';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type { ExportSource, ExportWarning } from '@/types/integrations';

export type BulkTrackerExportResult = {
    exported: string[];
    /** Linked to that tracker before the loop reached them. */
    skipped: string[];
    failed: BulkRefusal[];
};

type Options = {
    endpoints: ActionItemEndpoints;
    onSaved: (item: ActionItem) => void;
};

function asksToReconnect(error: RetroRequestError): boolean {
    const payload = error.payload as { reason?: unknown } | null;

    return payload?.reason === 'reconnect_required';
}

/** The item being sent counts: "Exporting 1 of 2…" while the first one runs. */
function progressOf(outcomes: BulkExportOutcome[]): {
    done: number;
    total: number;
} {
    return {
        done: Math.max(
            1,
            outcomes.filter((outcome) => outcome.state !== 'pending').length,
        ),
        total: outcomes.length,
    };
}

/**
 * "Sync to :tracker" of the bulk bar: the loop over the
 * export of one item, for the selected rows not linked to that tracker yet.
 * A tracker that asks to be reconnected answers every item the same way:
 * the loop stops at the first such answer.
 */
export function useBulkTrackerExport({ endpoints, onSaved }: Options): {
    start: (
        items: ActionItem[],
        source: ExportSource,
        target: ExportTarget,
    ) => Promise<BulkTrackerExportResult>;
    stop: () => void;
    progress: { done: number; total: number } | null;
    result: BulkTrackerExportResult | null;
} {
    const { t } = useTrans();
    const [progress, setProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [result, setResult] = useState<BulkTrackerExportResult | null>(null);
    const stopped = useRef(false);

    const start = async (
        items: ActionItem[],
        source: ExportSource,
        target: ExportTarget,
    ): Promise<BulkTrackerExportResult> => {
        const toExport = itemsToExport(items, source.source);
        const linkedBefore = items
            .filter((item) => !toExport.includes(item))
            .map((item) => item.id);
        const reconnectIds = new Set<string>();

        const exportOne = async (
            itemId: string,
        ): Promise<{ key: string; url: string }> => {
            let response: { actionItem: ActionItem; warnings: ExportWarning[] };

            try {
                response = await retroRequest(
                    endpoints.exportItem(itemId),
                    exportTargetBody(source.source, target),
                    { timeoutMs: ExportTimeoutMs },
                );
            } catch (error) {
                if (!(error instanceof RetroRequestError)) {
                    throw error;
                }

                if (error.status === 0) {
                    throw new BulkExportError(
                        0,
                        t(
                            'The server did not answer in time: the item may be exported already. Reload the page before you try again.',
                        ),
                    );
                }

                // A reconnect is a 409 too, which the loop counts as skipped.
                if (error.status === 409 && asksToReconnect(error)) {
                    reconnectIds.add(itemId);
                    stopped.current = true;
                }

                throw new BulkExportError(error.status, error.message);
            }

            onSaved(response.actionItem);

            const link = response.actionItem.externalLinks?.find(
                (candidate) => candidate.source === source.source,
            );

            return { key: link?.key ?? '', url: link?.url ?? '' };
        };

        stopped.current = false;
        setResult(null);
        setProgress(
            toExport.length === 0 ? null : { done: 1, total: toExport.length },
        );

        const outcomes = await runBulkExport(
            toExport.map((item) => item.id),
            exportOne,
            (latest) => setProgress(progressOf(latest)),
            () => stopped.current,
        );

        const titleOf = (itemId: string): string | null =>
            items.find((item) => item.id === itemId)?.content ?? null;
        const finished: BulkTrackerExportResult = {
            exported: outcomes
                .filter((outcome) => outcome.state === 'exported')
                .map((outcome) => outcome.itemId),
            skipped: [
                ...linkedBefore,
                ...outcomes
                    .filter(
                        (outcome) =>
                            outcome.state === 'skipped' &&
                            !reconnectIds.has(outcome.itemId),
                    )
                    .map((outcome) => outcome.itemId),
            ],
            failed: outcomes.flatMap((outcome) => {
                if (outcome.state === 'pending') {
                    return [
                        {
                            id: outcome.itemId,
                            title: titleOf(outcome.itemId),
                            message: t('Not sent: the export was stopped.'),
                        },
                    ];
                }

                return outcome.state === 'failed' ||
                    (outcome.state === 'skipped' &&
                        reconnectIds.has(outcome.itemId))
                    ? [
                          {
                              id: outcome.itemId,
                              title: titleOf(outcome.itemId),
                              message:
                                  outcome.message ?? t('Something went wrong.'),
                          },
                      ]
                    : [];
            }),
        };

        setProgress(null);
        setResult(finished);

        return finished;
    };

    return {
        start,
        stop: () => {
            stopped.current = true;
        },
        progress,
        result,
    };
}
