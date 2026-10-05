import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkExport } from '@/components/retro/bulk-export-dialog';
import { RetroRequestError } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import { actionItemFixture } from '@/test/action-items';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';
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
const linear: ExportSource = {
    source: 'linear',
    label: 'Linear',
    integrationId: 'integration-2',
};

function link(source: ExternalLink['source'], key: string): ExternalLink {
    return {
        id: `link-${key}`,
        source,
        key,
        url: `https://tracker.test/${key}`,
    } as ExternalLink;
}

function item(id: string, overrides: Partial<ActionItem> = {}): ActionItem {
    return actionItemFixture({ id, content: `Item ${id}`, ...overrides });
}

type Exported = (itemId: string) => unknown;

function answerWith(exported: Exported) {
    retroRequest.mockImplementation(
        async (route: { url: string; method: string }) => {
            if (route.method !== 'post') {
                return {
                    projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
                    issueTypes: [{ id: 't1', name: 'Task' }],
                    defaults: { projectId: 'p1', issueTypeId: 't1' },
                };
            }

            const itemId = route.url.split('/').at(-2) ?? '';
            const answer = exported(itemId);

            if (answer instanceof Error) {
                throw answer;
            }

            return answer;
        },
    );
}

function exportedAs(itemId: string, key: string, warnings: unknown[] = []) {
    return {
        actionItem: item(itemId, { externalLinks: [link('jira', key)] }),
        warnings,
    };
}

function renderExport(
    items: ActionItem[] = [item('a'), item('b'), item('c')],
    overrides: Parameters<typeof retroSnapshot>[0] = {},
) {
    const ctx = boardContext(
        retroSnapshot({
            retro: { phase: 'actions' },
            actionItems: items,
            exportSources: [jira],
            ...overrides,
        }),
    );

    return renderInBoard(<BulkExport />, ctx);
}

async function openAndStart(count: number) {
    fireEvent.click(screen.getByRole('button', { name: 'Export to Jira' }));

    const dialog = await screen.findByRole('dialog', {
        name: 'Export to Jira',
    });
    const submit = within(dialog).getByRole('button', {
        name: `Export ${count} items`,
    });

    await waitFor(() =>
        expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);

    return dialog;
}

function exportCalls() {
    return retroRequest.mock.calls.filter(
        ([route]) => (route as { method: string }).method === 'post',
    );
}

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    retroRequest.mockReset();
    answerWith((itemId) => exportedAs(itemId, `ATLAS-${itemId}`));
});

describe('BulkExport', () => {
    it('is one button named by the tracker for a member', () => {
        renderExport();

        expect(
            screen.getByRole('button', { name: 'Export to Jira' }),
        ).toBeTruthy();
    });

    it('is a menu of the trackers when the team has several', async () => {
        renderExport(undefined, { exportSources: [jira, linear] });

        fireEvent.keyDown(screen.getByRole('button', { name: 'Export' }), {
            key: 'Enter',
        });

        expect(
            await screen.findByRole('menuitem', { name: 'Export to Linear' }),
        ).toBeTruthy();
    });

    it('is hidden from a guest', () => {
        renderExport(undefined, {
            viewer: { isGuest: true, userId: null },
        });

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('is hidden when every item is already in the tracker', () => {
        renderExport([item('a', { externalLinks: [link('jira', 'ATLAS-1')] })]);

        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('BulkExportDialog', () => {
    it('lists the items not in the tracker yet, all ticked', async () => {
        renderExport([
            item('a'),
            item('b', { externalLinks: [link('jira', 'ATLAS-1')] }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Export to Jira' }));

        const dialog = await screen.findByRole('dialog', {
            name: 'Export to Jira',
        });

        expect(
            within(dialog).getByRole('checkbox', { name: 'Item a' }),
        ).toBeTruthy();
        expect(within(dialog).queryByText('Item b')).toBeNull();

        const submit = within(dialog).getByRole('button', {
            name: 'Export 1 item',
        });

        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        fireEvent.click(
            within(dialog).getByRole('checkbox', { name: 'Item a' }),
        );

        expect(
            (
                within(dialog).getByRole('button', {
                    name: 'Export 0 items',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('sends the requests one at a time with the chosen target and applies each answer', async () => {
        let inFlight = 0;
        let mostInFlight = 0;

        retroRequest.mockImplementation(
            async (route: { url: string; method: string }) => {
                if (route.method !== 'post') {
                    return {
                        projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
                        issueTypes: [{ id: 't1', name: 'Task' }],
                        defaults: { projectId: 'p1', issueTypeId: 't1' },
                    };
                }

                inFlight += 1;
                mostInFlight = Math.max(mostInFlight, inFlight);
                await Promise.resolve();
                inFlight -= 1;

                const itemId = route.url.split('/').at(-2) ?? '';

                return exportedAs(itemId, `ATLAS-${itemId}`, [
                    { code: 'assignee', message: `No account for ${itemId}.` },
                ]);
            },
        );

        const { ctx } = renderExport();
        const dialog = await openAndStart(3);

        expect(
            await within(dialog).findByText('3 exported, 0 failed'),
        ).toBeTruthy();
        expect(mostInFlight).toBe(1);
        expect(exportCalls().map(([route]) => route.url)).toEqual([
            '/retros/retro-1/action-items/a/exports',
            '/retros/retro-1/action-items/b/exports',
            '/retros/retro-1/action-items/c/exports',
        ]);
        expect(exportCalls()[0][1]).toEqual({
            source: 'jira',
            project_id: 'p1',
            issue_type_id: 't1',
        });
        expect(ctx.apply).toHaveBeenCalledTimes(3);
        expect(
            within(dialog).getByRole('link', { name: 'ATLAS-a' }),
        ).toBeTruthy();
        expect(within(dialog).getByText('No account for b.')).toBeTruthy();
    });

    it('reads "Already exported" for an item someone exported meanwhile, and retries the failed ones only', async () => {
        let attempts = 0;

        answerWith((itemId) => {
            if (itemId === 'b') {
                return new RetroRequestError(
                    409,
                    'Already exported as ATLAS-9.',
                );
            }

            if (itemId === 'c') {
                attempts += 1;

                return attempts === 1
                    ? new RetroRequestError(403, 'This action is unauthorized.')
                    : exportedAs('c', 'ATLAS-c');
            }

            return exportedAs(itemId, `ATLAS-${itemId}`);
        });

        renderExport();
        const dialog = await openAndStart(3);

        expect(
            await within(dialog).findByText(
                '1 exported, 1 already linked, 1 failed.',
            ),
        ).toBeTruthy();
        expect(within(dialog).getByText('Already exported')).toBeTruthy();
        expect(
            within(dialog).getByText('This action is unauthorized.'),
        ).toBeTruthy();

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Retry the failed ones',
            }),
        );

        expect(
            await within(dialog).findByText(
                '2 exported, 1 already linked, 0 failed.',
            ),
        ).toBeTruthy();
        expect(exportCalls().map(([route]) => route.url)).toEqual([
            '/retros/retro-1/action-items/a/exports',
            '/retros/retro-1/action-items/b/exports',
            '/retros/retro-1/action-items/c/exports',
            '/retros/retro-1/action-items/c/exports',
        ]);
    });

    it('asks before stopping, and stops after the item in progress', async () => {
        let release: () => void = () => {};

        retroRequest.mockImplementation(
            async (route: { url: string; method: string }) => {
                if (route.method !== 'post') {
                    return {
                        projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
                        issueTypes: [{ id: 't1', name: 'Task' }],
                        defaults: { projectId: 'p1', issueTypeId: 't1' },
                    };
                }

                await new Promise<void>((resolve) => {
                    release = resolve;
                });

                return exportedAs('a', 'ATLAS-a');
            },
        );

        const { ctx } = renderExport();
        const dialog = await openAndStart(3);

        expect(
            await within(dialog).findByText('Exporting 1 of 3…'),
        ).toBeTruthy();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Stop' }));

        const confirm = await screen.findByRole('alertdialog', {
            name: 'Stop the export?',
        });

        expect(
            within(confirm).getByText(
                'The items already exported stay in Jira. The one on its way may still arrive, the others are not sent.',
            ),
        ).toBeTruthy();
        expect(
            within(confirm).getByRole('button', { name: 'Keep exporting' }),
        ).toBeTruthy();

        fireEvent.click(within(confirm).getByRole('button', { name: 'Stop' }));
        release();

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(ctx.apply).toHaveBeenCalledTimes(1));
        await act(async () => {});

        expect(exportCalls()).toHaveLength(1);
    });

    it('says "Exported" when the answer holds no link to the issue', async () => {
        answerWith((itemId) => ({
            actionItem: item(itemId, { externalLinks: [] }),
            warnings: [
                { code: 'assignee', message: 'No account.' },
                { code: 'labels', message: 'No account.' },
            ],
        }));

        renderExport([item('a')]);

        fireEvent.click(screen.getByRole('button', { name: 'Export to Jira' }));

        const dialog = await screen.findByRole('dialog', {
            name: 'Export to Jira',
        });
        const submit = within(dialog).getByRole('button', {
            name: 'Export 1 item',
        }) as HTMLButtonElement;

        await waitFor(() => expect(submit.disabled).toBe(false));
        fireEvent.click(submit);

        expect(await within(dialog).findByText('Exported')).toBeTruthy();
        expect(within(dialog).queryByRole('link')).toBeNull();
        expect(within(dialog).getAllByText('No account.')).toHaveLength(2);
    });
});
