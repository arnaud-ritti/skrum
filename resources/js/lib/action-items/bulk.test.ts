import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actionItemsExportUrl,
    bulkDelete,
    bulkUpdate,
    matchingTarget,
} from '@/lib/action-items/bulk';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

describe('bulk client', () => {
    beforeEach(() => retroRequest.mockReset());

    it('posts the ids and the changes, with a long timeout', async () => {
        retroRequest.mockResolvedValue({
            actionItems: [],
            changedCount: 0,
            refused: [],
        });

        await bulkUpdate('acme', { ids: ['a', 'b'] }, { status: 'doing' });

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: '/w/acme/action-items/bulk-updates',
            }),
            { ids: ['a', 'b'], changes: { status: 'doing' } },
            { timeoutMs: 60_000 },
        );
    });

    it('posts the filters and the count of every matching item', async () => {
        retroRequest.mockResolvedValue({
            actionItems: [],
            changedCount: 137,
            refused: [],
        });

        const target = matchingTarget(
            {
                status: ['todo', 'doing'],
                priority: ['low'],
                due: null,
                source: null,
                assignee: null,
                team: 't1',
                item: 'x',
            },
            137,
        );
        await bulkUpdate('acme', target, { priority: 'high' });

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post' }),
            {
                filters: { priority: 'low', team: 't1' },
                count: 137,
                changes: { priority: 'high' },
            },
            { timeoutMs: 60_000 },
        );
    });

    it('posts the ids to delete', async () => {
        retroRequest.mockResolvedValue({ deleted: ['a'], refused: [] });

        expect(await bulkDelete('acme', { ids: ['a'] })).toEqual({
            deleted: ['a'],
            refused: [],
        });
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: '/w/acme/action-items/bulk-deletions',
            }),
            { ids: ['a'] },
            { timeoutMs: 60_000 },
        );
    });

    it('builds the export link from the filters, without the item', () => {
        expect(
            actionItemsExportUrl('acme', {
                status: ['completed'],
                priority: ['high'],
                due: 'week',
                source: null,
                assignee: 'me',
                team: 't1',
                item: 'x',
            }),
        ).toBe(
            '/w/acme/action-items/export?status=completed&priority=high&due=week&assignee=me&team=t1',
        );
    });
});
