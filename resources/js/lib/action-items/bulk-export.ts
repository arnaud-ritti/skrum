import type { ActionItem } from '@/lib/retro/types';
import type { TrackerProviderKey } from '@/types/integrations';

export type BulkExportOutcome =
    | { itemId: string; state: 'pending' | 'running' }
    | { itemId: string; state: 'exported'; key: string; url: string }
    | { itemId: string; state: 'failed' | 'skipped'; message: string | null };

/** What the export of one item throws: the status and the server's message. */
export class BulkExportError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

/** The items not exported to that tracker yet: one export per provider. */
export function itemsToExport(
    items: ActionItem[],
    source: TrackerProviderKey,
): ActionItem[] {
    return items.filter(
        (item) =>
            !(item.externalLinks ?? []).some((link) => link.source === source),
    );
}

/**
 * Exports the items one by one through the endpoint of a single item, so
 * each keeps its own rights, lock and "already exported" check. A 409 is an
 * item someone exported meanwhile: skipped, not failed.
 */
export async function runBulkExport(
    itemIds: string[],
    exportOne: (itemId: string) => Promise<{ key: string; url: string }>,
    onProgress: (outcomes: BulkExportOutcome[]) => void,
    shouldStop: () => boolean,
): Promise<BulkExportOutcome[]> {
    const outcomes: BulkExportOutcome[] = itemIds.map((itemId) => ({
        itemId,
        state: 'pending',
    }));

    for (const [index, itemId] of itemIds.entries()) {
        if (shouldStop()) {
            break;
        }

        outcomes[index] = { itemId, state: 'running' };
        onProgress([...outcomes]);

        try {
            const { key, url } = await exportOne(itemId);

            outcomes[index] = { itemId, state: 'exported', key, url };
        } catch (error) {
            outcomes[index] =
                error instanceof BulkExportError
                    ? {
                          itemId,
                          state: error.status === 409 ? 'skipped' : 'failed',
                          message: error.message,
                      }
                    : { itemId, state: 'failed', message: null };
        }

        onProgress([...outcomes]);
    }

    return outcomes;
}
