import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ItemExport,
    ItemExportDialog,
} from '@/components/action-items/item-export';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import { RetroRequestError } from '@/lib/retro/api';
import {
    actionItemFixture,
    actionItemMutationsFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';
import type { ExportSource, ExternalLink } from '@/types/integrations';

const retroRequest = vi.hoisted(() => vi.fn());
const page = vi.hoisted(() => ({ props: { translations: {} } }));
const toast = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

const linear: ExportSource = {
    source: 'linear',
    label: 'Linear',
    integrationId: 'integration-1',
};
const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-2',
};
const github: ExportSource = {
    source: 'github',
    label: 'GitHub',
    integrationId: 'integration-3',
};
const scope = { workspace: 'acme', canManagePeople: false };

function link(source: ExternalLink['source'], key: string): ExternalLink {
    return {
        id: `link-${key}`,
        source,
        key,
        url: `https://tracker.test/${key}`,
    } as ExternalLink;
}

type Answers = {
    targets?: unknown;
    preview?: unknown;
    exported?: unknown;
};

function answerWith({ targets, preview, exported }: Answers) {
    retroRequest.mockImplementation(
        async (route: { url: string; method: string }) => {
            if (route.url.includes('/exports/preview')) {
                if (preview === undefined) {
                    throw new RetroRequestError(500, 'No preview.');
                }

                return preview;
            }

            if (route.method === 'post') {
                if (exported instanceof Error) {
                    throw exported;
                }

                return exported;
            }

            if (targets instanceof Error) {
                throw targets;
            }

            return targets;
        },
    );
}

function renderExport(
    props: Partial<ComponentProps<typeof ItemExport>> = {},
    mutations = actionItemMutationsFixture(),
) {
    renderWithProviders(
        <ActionItemMutationsContext value={mutations}>
            <ItemExport
                item={actionItemFixture()}
                sources={[linear]}
                scope={scope}
                {...props}
            />
        </ActionItemMutationsContext>,
    );

    return mutations;
}

function renderDialog(
    props: Partial<ComponentProps<typeof ItemExportDialog>> = {},
    mutations = actionItemMutationsFixture(),
) {
    const onClose = vi.fn();

    renderWithProviders(
        <ActionItemMutationsContext value={mutations}>
            <ItemExportDialog
                item={actionItemFixture()}
                source={linear}
                scope={scope}
                onClose={onClose}
                {...props}
            />
        </ActionItemMutationsContext>,
    );

    return { mutations, onClose };
}

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    retroRequest.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
    toast.warning.mockReset();
    answerWith({
        targets: {
            teams: [
                { id: 'team-a', name: 'Atlas' },
                { id: 'team-b', name: 'Borealis' },
            ],
            defaults: { teamId: 'team-a' },
        },
        preview: {
            assignee: { state: 'none', displayName: null },
            priority: { name: 'Medium' },
        },
    });
});

describe('ItemExport', () => {
    it('is one button named by the only tracker', () => {
        renderExport();

        expect(
            screen.getByRole('button', { name: 'Export to Linear' }),
        ).toBeTruthy();
    });

    it('is a menu when the team has several trackers', async () => {
        renderExport({ sources: [linear, jira] });

        const trigger = screen.getByRole('button', { name: 'Export' });

        fireEvent.keyDown(trigger, { key: 'Enter' });

        expect(
            await screen.findByRole('menuitem', { name: 'Export to Linear' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('menuitem', { name: 'Export to Jira' }),
        ).toBeTruthy();
    });

    it('leaves out a tracker the item already went to', () => {
        renderExport({
            sources: [linear, jira],
            item: actionItemFixture({
                externalLinks: [link('jira', 'PROJ-42')],
            }),
        });

        expect(
            screen.getByRole('button', { name: 'Export to Linear' }),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    });

    it('renders nothing once the item is in every tracker, or without one', () => {
        renderExport({
            item: actionItemFixture({
                externalLinks: [link('linear', 'ENG-7')],
            }),
        });
        renderExport({ sources: [] });

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('opens the export dialog of the chosen tracker', async () => {
        renderExport();

        fireEvent.click(
            screen.getByRole('button', { name: 'Export to Linear' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Export to Linear' }),
        ).toBeTruthy();
    });
});

describe('ItemExportDialog', () => {
    it('proposes the default Linear team and previews the issue', async () => {
        renderDialog();

        const team = await screen.findByRole('combobox', {
            name: 'Linear team',
        });

        expect(team.textContent).toContain('Atlas');
        expect(await screen.findByText('Unassigned')).toBeTruthy();
        expect(screen.getByText('Priority: Medium')).toBeTruthy();
    });

    it('exports, hands the item back, says its key and closes', async () => {
        const exported = actionItemFixture({
            externalLinks: [link('linear', 'ENG-42')],
        });

        answerWith({
            targets: {
                teams: [{ id: 'team-a', name: 'Atlas' }],
                defaults: { teamId: 'team-a' },
            },
            exported: {
                actionItem: exported,
                warnings: [
                    { code: 'assignee', message: 'Bob has no Linear account.' },
                    { code: 'silent', message: null },
                ],
            },
        });

        const { mutations, onClose } = renderDialog();

        await screen.findByRole('combobox', { name: 'Linear team' });

        const submit = screen.getByRole('button', { name: 'Export' });

        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        fireEvent.click(submit);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/items/item-1/exports', method: 'post' },
            { source: 'linear', team_id: 'team-a' },
            { timeoutMs: 45_000 },
        );
        expect(mutations.onSaved).toHaveBeenCalledWith(exported);
        expect(toast.success).toHaveBeenCalledWith('Exported as ENG-42.');
        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(toast.warning).toHaveBeenCalledWith(
            'Bob has no Linear account.',
        );
    });

    it('stays open when the export fails', async () => {
        answerWith({
            targets: {
                teams: [{ id: 'team-a', name: 'Atlas' }],
                defaults: { teamId: 'team-a' },
            },
            exported: new RetroRequestError(502, 'Linear is down.'),
        });

        const { mutations, onClose } = renderDialog();

        await screen.findByRole('combobox', { name: 'Linear team' });

        const submit = screen.getByRole('button', { name: 'Export' });

        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        fireEvent.click(submit);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'post' }),
                expect.anything(),
                expect.anything(),
            ),
        );
        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        expect(onClose).not.toHaveBeenCalled();
        expect(mutations.onSaved).not.toHaveBeenCalled();
    });

    it('says why the tracker cannot be reached and cannot export', async () => {
        answerWith({ targets: new RetroRequestError(502, 'Token revoked.') });

        renderDialog();

        expect(await screen.findByText('Token revoked.')).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Export',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('asks Jira for a project and an issue type', async () => {
        answerWith({
            targets: {
                projects: [{ id: 'p1', key: 'PROJ', name: 'Project' }],
                issueTypes: [{ id: 't1', name: 'Task' }],
                defaults: { projectId: 'p1', issueTypeId: 't1' },
            },
            exported: {
                actionItem: actionItemFixture({
                    externalLinks: [link('jira', 'PROJ-42')],
                }),
                warnings: [],
            },
        });

        renderDialog({ source: jira });

        expect(
            (await screen.findByRole('combobox', { name: 'Project' }))
                .textContent,
        ).toContain('PROJ — Project');
        expect(
            screen.getByRole('combobox', { name: 'Issue type' }).textContent,
        ).toContain('Task');
        expect(screen.getByLabelText('Search projects')).toBeTruthy();

        const submit = screen.getByRole('button', { name: 'Export' });

        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        fireEvent.click(submit);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                { url: '/items/item-1/exports', method: 'post' },
                { source: 'jira', project_id: 'p1', issue_type_id: 't1' },
                { timeoutMs: 45_000 },
            ),
        );
    });

    it('searches the Jira projects after a pause and says when none matches', async () => {
        answerWith({
            targets: {
                projects: [{ id: 'p1', key: 'PROJ', name: 'Project' }],
                issueTypes: [{ id: 't1', name: 'Task' }],
                defaults: { projectId: 'p1', issueTypeId: 't1' },
            },
        });

        renderDialog({ source: jira });

        const search = await screen.findByLabelText('Search projects');

        answerWith({
            targets: {
                projects: [],
                issueTypes: [{ id: 't1', name: 'Task' }],
                defaults: { projectId: 'p1', issueTypeId: 't1' },
            },
        });

        const callsBefore = retroRequest.mock.calls.length;

        fireEvent.change(search, { target: { value: 'zzz' } });

        expect(retroRequest.mock.calls.length).toBe(callsBefore);

        expect(await screen.findByText('No project found.')).toBeTruthy();

        const searched = new URL(
            retroRequest.mock.calls.at(-1)?.[0].url,
            'http://skrum.test',
        );

        expect(searched.searchParams.get('q')).toBe('zzz');
        expect(searched.searchParams.get('project_id')).toBe('p1');
        expect(
            screen.getByRole('combobox', { name: 'Project' }).textContent,
        ).toContain('PROJ — Project');
    });

    it('names the tracker alone for an assignee mapped without a name', async () => {
        answerWith({
            targets: {
                teams: [{ id: 'team-a', name: 'Atlas' }],
                defaults: { teamId: 'team-a' },
            },
            preview: {
                assignee: { state: 'mapped', displayName: null },
                priority: { name: 'Medium' },
            },
        });

        renderDialog();

        expect(
            await screen.findByText('Assignee: mapped in Linear'),
        ).toBeTruthy();
    });

    it('names the tracker when the export comes back without its link', async () => {
        answerWith({
            targets: {
                teams: [{ id: 'team-a', name: 'Atlas' }],
                defaults: { teamId: 'team-a' },
            },
            exported: { actionItem: actionItemFixture(), warnings: [] },
        });

        const { onClose } = renderDialog();

        await screen.findByRole('combobox', { name: 'Linear team' });

        const submit = screen.getByRole('button', { name: 'Export' });

        await waitFor(() =>
            expect((submit as HTMLButtonElement).disabled).toBe(false),
        );
        fireEvent.click(submit);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(toast.success).toHaveBeenCalledWith('Exported to Linear.');
    });

    it('asks GitHub for a repository', async () => {
        answerWith({
            targets: {
                repositories: [{ id: 'r1', name: 'acme/api' }],
                defaults: { repositoryId: 'r1' },
            },
            preview: {
                assignee: { state: 'willMatch', displayName: 'Bob Stone' },
                priority: { name: null },
            },
        });

        renderDialog({ source: github });

        expect(
            (await screen.findByRole('combobox', { name: 'Repository' }))
                .textContent,
        ).toContain('acme/api');
        expect(screen.getByLabelText('Search repositories')).toBeTruthy();
        expect(
            await screen.findByText(
                "Assignee: not mapped yet — skrum will use Bob Stone's GitHub sign-in",
            ),
        ).toBeTruthy();
        expect(screen.getByText('No priority label')).toBeTruthy();
    });

    it('links to the people mapping for a workspace manager only', async () => {
        renderDialog();

        await screen.findByRole('combobox', { name: 'Linear team' });

        expect(
            screen.queryByRole('link', { name: 'Manage people' }),
        ).toBeNull();

        renderDialog({ scope: { workspace: 'acme', canManagePeople: true } });

        expect(
            (await screen.findAllByRole('link', { name: 'Manage people' }))
                .length,
        ).toBe(1);
    });

    it('closes on Cancel without exporting', async () => {
        const { onClose } = renderDialog();

        await screen.findByRole('combobox', { name: 'Linear team' });

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalled();
        expect(retroRequest).not.toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post' }),
            expect.anything(),
            expect.anything(),
        );
    });
});
