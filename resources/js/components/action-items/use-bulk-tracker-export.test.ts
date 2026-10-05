import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyExportTarget } from '@/components/action-items/export-target-fields';
import { useBulkTrackerExport } from '@/components/action-items/use-bulk-tracker-export';
import { RetroRequestError } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
} from '@/test/action-items';
import type { ExportSource, ExternalLink } from '@/types/integrations';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-1',
};

const target = { ...EmptyExportTarget, projectId: '10', issueTypeId: '3' };

function link(key: string): ExternalLink {
    return {
        id: `link-${key}`,
        source: 'jira',
        key,
        url: `https://jira.test/${key}`,
        state: 'open',
        statusName: 'To Do',
        syncState: 'synced',
        syncError: null,
        lastSyncedAt: null,
    } as ExternalLink;
}

function exported(item: ActionItem, key: string) {
    return {
        actionItem: { ...item, externalLinks: [link(key)] },
        warnings: [],
    };
}

const first = actionItemFixture({ id: 'a', content: 'Fix the build' });
const second = actionItemFixture({ id: 'b', content: 'Write the runbook' });
const linked = actionItemFixture({
    id: 'c',
    content: 'Rotate the keys',
    externalLinks: [link('OPS-1')],
});

function setup() {
    const onSaved = vi.fn();
    const hook = renderHook(() =>
        useBulkTrackerExport({
            endpoints: actionItemEndpointsFixture(),
            onSaved,
        }),
    );

    return { onSaved, hook };
}

describe('useBulkTrackerExport', () => {
    beforeEach(() => {
        retroRequest.mockReset();
    });

    it('exports the unlinked items in order and skips a linked one', async () => {
        retroRequest
            .mockResolvedValueOnce(exported(first, 'OPS-2'))
            .mockResolvedValueOnce(exported(second, 'OPS-3'));
        const { onSaved, hook } = setup();

        await act(() =>
            hook.result.current.start([first, linked, second], jira, target),
        );

        expect(retroRequest.mock.calls.map((call) => call[0].url)).toEqual([
            '/items/a/exports',
            '/items/b/exports',
        ]);
        expect(retroRequest.mock.calls[0][1]).toEqual({
            source: 'jira',
            project_id: '10',
            issue_type_id: '3',
        });
        expect(onSaved).toHaveBeenCalledTimes(2);
        expect(hook.result.current.result).toEqual({
            exported: ['a', 'b'],
            skipped: ['c'],
            failed: [],
        });
        expect(hook.result.current.progress).toBeNull();
    });

    it('counts the item being exported', async () => {
        let finish: (value: unknown) => void = () => {};

        retroRequest.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        retroRequest.mockResolvedValueOnce(exported(second, 'OPS-3'));
        const { hook } = setup();
        let running: Promise<unknown> = Promise.resolve();

        act(() => {
            running = hook.result.current.start([first, second], jira, target);
        });

        expect(hook.result.current.progress).toEqual({ done: 1, total: 2 });

        await act(async () => {
            finish(exported(first, 'OPS-2'));
            await running;
        });
    });

    it('stops on a reconnect answer and reports it', async () => {
        retroRequest.mockRejectedValueOnce(
            new RetroRequestError(
                409,
                'Reconnect Jira in the team settings.',
                {},
                {
                    message: 'Reconnect Jira in the team settings.',
                    reason: 'reconnect_required',
                },
            ),
        );
        const { hook } = setup();

        await act(() =>
            hook.result.current.start([first, second], jira, target),
        );

        expect(retroRequest).toHaveBeenCalledOnce();
        expect(hook.result.current.result).toEqual({
            exported: [],
            skipped: [],
            failed: [
                {
                    id: 'a',
                    title: 'Fix the build',
                    message: 'Reconnect Jira in the team settings.',
                },
                {
                    id: 'b',
                    title: 'Write the runbook',
                    message: 'Not sent: the export was stopped.',
                },
            ],
        });
    });

    it('counts an item exported meanwhile as already linked and goes on', async () => {
        retroRequest
            .mockRejectedValueOnce(
                new RetroRequestError(409, 'Already exported as OPS-9.'),
            )
            .mockResolvedValueOnce(exported(second, 'OPS-3'));
        const { hook } = setup();

        await act(() =>
            hook.result.current.start([first, second], jira, target),
        );

        expect(hook.result.current.result).toEqual({
            exported: ['b'],
            skipped: ['a'],
            failed: [],
        });
    });

    it('lists a failed item with its sentence and goes on', async () => {
        retroRequest
            .mockRejectedValueOnce(
                new RetroRequestError(422, 'The project is required.'),
            )
            .mockResolvedValueOnce(exported(second, 'OPS-3'));
        const { hook } = setup();

        await act(() =>
            hook.result.current.start([first, second], jira, target),
        );

        expect(hook.result.current.result?.failed).toEqual([
            {
                id: 'a',
                title: 'Fix the build',
                message: 'The project is required.',
            },
        ]);
        expect(hook.result.current.result?.exported).toEqual(['b']);
    });

    it('ends after the current item when stopped', async () => {
        let finish: (value: unknown) => void = () => {};

        retroRequest.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        const { hook } = setup();
        let running: Promise<unknown> = Promise.resolve();

        act(() => {
            running = hook.result.current.start([first, second], jira, target);
        });
        act(() => hook.result.current.stop());

        await act(async () => {
            finish(exported(first, 'OPS-2'));
            await running;
        });

        expect(retroRequest).toHaveBeenCalledOnce();
        expect(hook.result.current.result?.exported).toEqual(['a']);
    });
});
