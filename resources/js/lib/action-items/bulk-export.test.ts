import { describe, expect, it, vi } from 'vitest';
import type { ActionItem } from '@/lib/retro/types';
import type { ExternalLink } from '@/types/integrations';
import { BulkExportError, itemsToExport, runBulkExport } from './bulk-export';

describe('runBulkExport', () => {
    it('exports one item after the other and reports each outcome', async () => {
        const order: string[] = [];
        const exportOne = vi.fn(async (id: string) => {
            order.push(id);

            if (id === 'b') {
                throw new BulkExportError(422, 'The project is archived.');
            }

            if (id === 'c') {
                throw new BulkExportError(409, 'Already exported as ATLAS-9.');
            }

            return { key: `ATLAS-${id}`, url: `https://jira/${id}` };
        });
        const progress = vi.fn();

        const outcomes = await runBulkExport(
            ['a', 'b', 'c'],
            exportOne,
            progress,
            () => false,
        );

        expect(order).toEqual(['a', 'b', 'c']);
        expect(outcomes).toEqual([
            {
                itemId: 'a',
                state: 'exported',
                key: 'ATLAS-a',
                url: 'https://jira/a',
            },
            {
                itemId: 'b',
                state: 'failed',
                message: 'The project is archived.',
            },
            {
                itemId: 'c',
                state: 'skipped',
                message: 'Already exported as ATLAS-9.',
            },
        ]);
        expect(progress).toHaveBeenCalledTimes(6);
    });

    it('stops after the item in progress', async () => {
        let stop = false;
        const exportOne = vi.fn(async (id: string) => {
            stop = true;

            return { key: id, url: id };
        });

        const outcomes = await runBulkExport(
            ['a', 'b'],
            exportOne,
            () => {},
            () => stop,
        );

        expect(exportOne).toHaveBeenCalledTimes(1);
        expect(outcomes.map((outcome) => outcome.state)).toEqual([
            'exported',
            'pending',
        ]);
    });

    it('turns an unknown error into a failure with no message', async () => {
        const outcomes = await runBulkExport(
            ['a'],
            async () => {
                throw new Error('network');
            },
            () => {},
            () => false,
        );

        expect(outcomes).toEqual([
            { itemId: 'a', state: 'failed', message: null },
        ]);
    });
});

describe('itemsToExport', () => {
    const link = (source: ExternalLink['source']) =>
        ({ id: `link-${source}`, source, key: 'K-1' }) as ExternalLink;
    const items = [
        { id: 'linked', externalLinks: [link('jira')] },
        { id: 'free', externalLinks: [] },
    ] as unknown as ActionItem[];

    it('leaves out an item linked to that tracker and keeps it for another', () => {
        expect(itemsToExport(items, 'jira').map((item) => item.id)).toEqual([
            'free',
        ]);
        expect(itemsToExport(items, 'linear').map((item) => item.id)).toEqual([
            'linked',
            'free',
        ]);
    });
});
