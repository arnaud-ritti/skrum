import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { RetroRequestError } from '@/lib/retro/api';
import {
    providerButtons,
    providerPanel,
    providerStatus,
    renderProvider,
} from '@/test/integrations';
import { renderWithProviders } from '@/test/render';
import type {
    IntegrationProviderCard,
    IntegrationProviderKey,
    TeamIntegration,
    UserMappingRow,
} from '@/types';
import { AccountPickerDialog } from './account-picker-dialog';
import { GitHubIntegration } from './github-integration';
import { GitHubPriorityLabels } from './github-priority-labels';
import { JiraDataCenterIntegration } from './jira-data-center-integration';
import { JiraDataCenterWebhookPanel } from './jira-data-center-webhook-panel';
import { JiraIntegration } from './jira-integration';
import { JiraTokenDialog } from './jira-token-dialog';
import { LinearIntegration } from './linear-integration';
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';
import { StatusMappingPanel } from './status-mapping-panel';
import { StatusSyncSection } from './status-sync-section';
import { StoryPointsField } from './story-points-field';

const router = vi.hoisted(() => ({ reload: vi.fn() }));
const request = vi.hoisted(() => vi.fn());
const copy = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() =>
    Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', pollMinutes: 5 },
    }),
    router,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: request,
}));

vi.mock('@/hooks/use-clipboard', () => ({
    useClipboard: () => [null, copy],
}));

vi.mock('sonner', () => ({ toast }));

const scope = { workspace: 'nordlys', team: 't1' };

function connection(
    provider: IntegrationProviderKey,
    overrides: Partial<TeamIntegration> = {},
): TeamIntegration {
    return {
        id: 'i1',
        provider,
        status: 'active',
        statusLabel: 'Connected',
        access: 'write',
        settings: {},
        connectedBy: 'Ada Admin',
        connectedAt: '2026-09-14T09:00:00Z',
        lastCheckedAt: null,
        lastError: null,
        statusSync: false,
        inboundMode: 'off',
        webhookStatus: null,
        lastInboundAt: null,
        lastPolledAt: null,
        inboundHint: null,
        ...overrides,
    } as TeamIntegration;
}

const labels: Partial<Record<IntegrationProviderKey, string>> = {
    jira: 'Jira',
    jira_dc: 'Jira Data Center',
    linear: 'Linear',
    github: 'GitHub',
};

function card(
    provider: IntegrationProviderKey,
    value: TeamIntegration | null = null,
    authMethods: string[] = ['oauth'],
): IntegrationProviderCard {
    return {
        provider,
        label: labels[provider] ?? provider,
        usesOAuth: true,
        authMethods,
        isTracker: true,
        connection: value,
    } as IntegrationProviderCard;
}

function member(overrides: Partial<UserMappingRow> = {}): UserMappingRow {
    return {
        userId: 'u1',
        name: 'Bob Member',
        email: 'bob@example.test',
        avatarUrl: '',
        mapping: null,
        ...overrides,
    };
}

function isDisabled(element: HTMLElement): boolean {
    return (element as HTMLButtonElement).disabled;
}

function linkTexts(container: HTMLElement): (string | null)[] {
    return within(container)
        .getAllByRole('link')
        .map((link) => link.textContent);
}

beforeEach(() => {
    router.reload.mockReset();
    request.mockReset();
    copy.mockReset();
    toast.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
});

describe('StatusSyncSection', () => {
    const jira = connection('jira');

    it('offers status sync as a switch inside its label, off at first', () => {
        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira', jira)}
                connection={jira}
            />,
        );

        const sync = screen.getByRole('switch', { name: 'Sync status' });

        expect(sync.getAttribute('aria-checked')).toBe('false');
        expect(sync.closest('label')?.textContent).toContain('Sync status');
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(
            screen.queryByRole('switch', { name: 'Treat canceled as done' }),
        ).toBeNull();
        expect(screen.queryByText('Checking every 5 minutes.')).toBeNull();
    });

    it('asks before the first sync, then turns it on', async () => {
        request.mockResolvedValue(undefined);

        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira', jira)}
                connection={jira}
            />,
        );

        await userEvent.click(
            screen.getByRole('switch', { name: 'Sync status' }),
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Turn on status sync with Jira?',
        });

        expect(request).not.toHaveBeenCalled();
        expect(dialog.textContent).toContain(
            'The first sync takes the state of every linked Jira issue',
        );

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Turn on status sync' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Status sync is on.'),
        );
        expect(request.mock.calls[0][0].url).toContain('/integrations/i1');
        expect(request.mock.calls[0][1]).toEqual({ status_sync: true });
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sends nothing when the confirmation is cancelled', async () => {
        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira', jira)}
                connection={jira}
            />,
        );

        await userEvent.click(
            screen.getByRole('switch', { name: 'Sync status' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(request).not.toHaveBeenCalled();
    });

    it('turns the sync off without asking', async () => {
        request.mockResolvedValue(undefined);
        const synced = connection('jira', { statusSync: true });

        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira', synced)}
                connection={synced}
            />,
        );

        await userEvent.click(
            screen.getByRole('switch', { name: 'Sync status' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Status sync is off.'),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({ status_sync: false });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('says how the changes arrive and when the last sync ran', () => {
        request.mockResolvedValue({ containers: [] });
        const synced = connection('jira', {
            statusSync: true,
            inboundMode: 'webhook',
            webhookStatus: 'active',
            lastPolledAt: '2026-09-30T09:00:00Z',
            lastInboundAt: '2026-09-30T10:00:00Z',
        } as Partial<TeamIntegration>);

        const { rerender } = renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira', synced)}
                connection={synced}
            />,
        );

        const mode = (): string =>
            document.querySelector('[data-slot="status-sync-mode"]')
                ?.textContent ?? '';

        expect(mode()).toContain('Live updates (webhooks)');
        expect(mode()).toContain('Last sync:');

        const failing = { ...synced, webhookStatus: 'failing' };

        rerender(
            <StatusSyncSection
                scope={scope}
                card={card('jira', failing as TeamIntegration)}
                connection={failing as TeamIntegration}
            />,
        );

        expect(mode()).toContain(
            "Webhooks aren't reaching skrum; checking every 5 minutes.",
        );

        const pending = { ...synced, webhookStatus: 'pending' };

        rerender(
            <StatusSyncSection
                scope={scope}
                card={card('jira', pending as TeamIntegration)}
                connection={pending as TeamIntegration}
            />,
        );

        expect(mode()).toContain('Setting up live updates…');

        const polling = {
            ...synced,
            inboundMode: 'polling',
            webhookStatus: null,
            inboundHint: 'reconnect',
        };

        rerender(
            <StatusSyncSection
                scope={scope}
                card={card('jira', polling as TeamIntegration)}
                connection={polling as TeamIntegration}
            />,
        );

        expect(mode()).toContain('Checking every 5 minutes.');
        expect(mode()).toContain('Reconnect Jira to receive live updates.');
    });

    it('offers "Treat canceled as done" as a switch for Linear, on by default, and saves it', async () => {
        request.mockResolvedValue({ containers: [] });
        const linear = connection('linear', { statusSync: true });

        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('linear', linear)}
                connection={linear}
            />,
        );

        const treat = screen.getByRole('switch', {
            name: 'Treat canceled as done',
        });

        expect(treat.getAttribute('aria-checked')).toBe('true');
        expect(treat.closest('label')?.textContent).toContain(
            'Treat canceled as done',
        );

        await userEvent.click(treat);

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                'Status sync setting saved.',
            ),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({
            treat_canceled_as_done: false,
        });
    });

    it('maps no statuses for GitHub and shows the manual webhook panel of Jira Data Center', () => {
        request.mockResolvedValue({ containers: [] });
        const github = connection('github', { statusSync: true });

        const { unmount } = renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('github', github)}
                connection={github}
            />,
        );

        expect(
            screen.getByRole('switch', { name: 'Treat canceled as done' }),
        ).toBeTruthy();
        expect(screen.queryByText('Status mapping')).toBeNull();

        unmount();

        const dataCenter = connection('jira_dc', {
            statusSync: true,
            inboundHint: 'manual',
        } as Partial<TeamIntegration>);

        renderWithProviders(
            <StatusSyncSection
                scope={scope}
                card={card('jira_dc', dataCenter)}
                connection={dataCenter}
            />,
        );

        expect(
            screen.getByText(
                'Only a Jira administrator can register the webhook. Ask one to add it in Jira (System → WebHooks) with these details.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('Status mapping')).toBeTruthy();
        expect(
            screen.queryByRole('switch', { name: 'Treat canceled as done' }),
        ).toBeNull();
    });
});

describe('JiraTokenDialog', () => {
    async function open(): Promise<HTMLElement> {
        renderWithProviders(
            <JiraTokenDialog
                scope={scope}
                label="Use a personal access token"
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Use a personal access token' }),
        );

        return screen.getByRole('dialog', { name: 'Personal access token' });
    }

    it('keeps "Save token" disabled until "I understand" is ticked', async () => {
        const dialog = await open();
        const save = within(dialog).getByRole('button', { name: 'Save token' });
        const token = within(dialog).getByLabelText('Personal access token');
        const understood = within(dialog).getByRole('checkbox', {
            name: 'I understand',
        });

        expect(token.getAttribute('type')).toBe('password');
        expect(token.getAttribute('autocomplete')).toBe('off');
        expect(save.getAttribute('type')).toBe('submit');
        expect(isDisabled(save)).toBe(true);
        expect(understood.closest('label')?.textContent).toContain(
            'I understand',
        );
        expect(within(dialog).getByRole('note').textContent).toContain(
            'This token acts as its owner in Jira.',
        );

        await userEvent.click(understood);

        expect(isDisabled(save)).toBe(false);
    });

    it('sends the token, the chosen access and the acknowledgement, then closes', async () => {
        request.mockResolvedValue(undefined);
        const dialog = await open();

        await userEvent.type(
            within(dialog).getByLabelText('Personal access token'),
            'pasted-jira-token-abcdefghijklmnop',
        );
        await userEvent.click(
            within(dialog).getByRole('radio', { name: 'Read and write' }),
        );
        await userEvent.click(
            within(dialog).getByRole('checkbox', { name: 'I understand' }),
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save token' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Token saved.'),
        );
        expect(request.mock.calls[0][1]).toEqual({
            token: 'pasted-jira-token-abcdefghijklmnop',
            access: 'write',
            acknowledged: true,
        });
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('shows a refusal under the field and stays open', async () => {
        request.mockRejectedValue(
            new RetroRequestError(422, 'Invalid.', {
                token: ["Jira didn't accept this token."],
            }),
        );
        const dialog = await open();
        const token = within(dialog).getByLabelText('Personal access token');

        await userEvent.type(token, 'pasted-jira-token-abcdefghijklmnop');
        await userEvent.click(
            within(dialog).getByRole('checkbox', { name: 'I understand' }),
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save token' }),
        );

        await waitFor(() =>
            expect(
                dialog.querySelector('[data-slot="field-error"]')?.textContent,
            ).toBe("Jira didn't accept this token."),
        );
        expect(token.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(token);
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(toast.success).not.toHaveBeenCalled();
        expect(request.mock.calls[0][1]).toMatchObject({ access: 'read' });
    });
});

describe('StoryPointsField', () => {
    const jira = connection('jira', {
        settings: {
            storyPointFields: [
                { id: 'customfield_10016', name: 'Story point estimate' },
            ],
            numberFields: [
                { id: 'customfield_10016', name: 'Story point estimate' },
                { id: 'customfield_10050', name: 'Business value' },
            ],
        },
    } as Partial<TeamIntegration>);

    it('names the select, shows the saved field and detects again', async () => {
        request.mockResolvedValue(undefined);

        renderWithProviders(
            <StoryPointsField scope={scope} connection={jira} />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Story points field' })
                .textContent,
        ).toContain('Story point estimate');

        await userEvent.click(
            screen.getByRole('button', { name: 'Detect again' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                'Fields detected again.',
            ),
        );
        expect(request.mock.calls[0][0].method).toBe('post');
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('says so when Jira has no number field, and hides "Detect again" until the connection works', () => {
        const empty = connection('jira', { status: 'reconnect_required' });

        renderWithProviders(
            <StoryPointsField scope={scope} connection={empty} />,
        );

        expect(screen.getByText('No story points field found.')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Detect again' }),
        ).toBeNull();
    });
});

describe('PeoplePanel', () => {
    const jira = connection('jira');
    const members = [
        member(),
        member({
            userId: 'u2',
            name: 'Cleo Member',
            email: 'cleo@example.test',
            mapping: {
                accountId: 'acc-cleo',
                displayName: 'Cleo Stone',
                matchedBy: 'manual',
                accountInactive: false,
            },
        }),
        member({
            userId: 'u3',
            name: 'Dan Member',
            email: 'dan@example.test',
            mapping: {
                accountId: null,
                displayName: null,
                matchedBy: 'manual',
                accountInactive: false,
            },
        }),
    ];

    it('lists one item per member with the account and how it was matched', async () => {
        request.mockResolvedValue({ members, matching: false });

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={jira}
                providerLabel="Jira"
            />,
        );

        const items = await screen.findAllByRole('listitem');

        expect(items).toHaveLength(3);
        expect(items[0].textContent).toContain('bob@example.test');
        expect(items[0].textContent).toContain('Not mapped');
        expect(items[1].textContent).toContain('Cleo Stone');
        expect(items[1].textContent).toContain('Set manually');
        expect(items[2].textContent).toContain('Never assign');
        expect(
            screen.getByText(
                "Jira: members' emails are looked up on your Jira site.",
            ),
        ).toBeTruthy();
    });

    it('sets a member to never assign from the row menu', async () => {
        request.mockResolvedValueOnce({ members, matching: false });
        request.mockResolvedValueOnce({
            ...members[0],
            mapping: {
                accountId: null,
                displayName: null,
                matchedBy: 'manual',
                accountInactive: false,
            },
        });

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={jira}
                providerLabel="Jira"
            />,
        );

        await userEvent.click(
            await screen.findByRole('button', {
                name: 'Change the Jira account of Bob Member',
            }),
        );

        expect(
            screen.getAllByRole('menuitem').map((item) => item.textContent),
        ).toEqual(['Choose an account…', 'Never assign']);

        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Never assign' }),
        );

        await waitFor(() =>
            expect(screen.getAllByRole('listitem')[0].textContent).toContain(
                'Never assign',
            ),
        );
        expect(request.mock.calls[1][1]).toEqual({ external_account_id: null });
    });

    it('offers "Reset" for a mapped member only', async () => {
        request.mockResolvedValueOnce({ members, matching: false });
        request.mockResolvedValueOnce(undefined);

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={jira}
                providerLabel="Jira"
            />,
        );

        await userEvent.click(
            await screen.findByRole('button', {
                name: 'Change the Jira account of Cleo Member',
            }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Reset' }));

        await waitFor(() =>
            expect(screen.getAllByRole('listitem')[1].textContent).toContain(
                'Not mapped',
            ),
        );
        expect(request.mock.calls[1][0].method).toBe('delete');
    });

    it('disables the matching button while the matching runs', async () => {
        request.mockResolvedValueOnce({ members, matching: false });
        request.mockResolvedValueOnce(undefined);

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={jira}
                providerLabel="Jira"
            />,
        );

        const match = screen.getByRole('button', { name: 'Match by email' });

        expect(isDisabled(match)).toBe(true);

        await screen.findAllByRole('listitem');

        expect(isDisabled(match)).toBe(false);

        await userEvent.click(match);

        await waitFor(() =>
            expect(
                isDisabled(
                    screen.getByRole('button', { name: 'Match by email' }),
                ),
            ).toBe(true),
        );
    });

    it('names the button after the GitHub sign-ins for GitHub', async () => {
        request.mockResolvedValue({ members: [], matching: false });

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={connection('github')}
                providerLabel="GitHub"
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Match GitHub sign-ins' }),
        ).toBeTruthy();
    });

    it('says the people could not be loaded and loads them again on "Retry"', async () => {
        request.mockRejectedValueOnce(new Error('down'));
        request.mockResolvedValueOnce({ members, matching: false });

        renderWithProviders(
            <PeoplePanel
                scope={scope}
                connection={jira}
                providerLabel="Jira"
            />,
        );

        expect((await screen.findByRole('alert')).textContent).toContain(
            'Could not load the people of this team.',
        );

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findAllByRole('listitem')).toHaveLength(3);
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('AccountPickerDialog', () => {
    it('searches from two characters and gives back the chosen account', async () => {
        request.mockResolvedValue([
            { accountId: 'acc-cleo', displayName: 'Cleo Stone' },
        ]);
        const onChoose = vi.fn();

        renderWithProviders(
            <AccountPickerDialog
                scope={scope}
                connection={connection('jira')}
                providerLabel="Jira"
                memberName="Cleo Member"
                onClose={vi.fn()}
                onChoose={onChoose}
            />,
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Jira account of Cleo Member',
        });
        const search = within(dialog).getByRole('searchbox', {
            name: 'Search',
        });

        expect(search.getAttribute('aria-label')).toBe('Search');
        expect(dialog.textContent).toContain(
            'Search by name or email. Emails are not shown.',
        );

        await userEvent.type(search, 'c');

        expect(request).not.toHaveBeenCalled();

        await userEvent.type(search, 'leo');
        await userEvent.click(
            await within(dialog).findByRole('button', { name: 'Cleo Stone' }),
        );

        expect(onChoose).toHaveBeenCalledWith('acc-cleo');
        expect(request.mock.calls.at(-1)?.[0].url).toContain('q=cleo');
    });

    it('says when no account matches', async () => {
        request.mockResolvedValue([]);

        renderWithProviders(
            <AccountPickerDialog
                scope={scope}
                connection={connection('jira')}
                providerLabel="Jira"
                memberName="Cleo Member"
                onClose={vi.fn()}
                onChoose={vi.fn()}
            />,
        );

        await userEvent.type(
            screen.getByRole('searchbox', { name: 'Search' }),
            'zz',
        );

        expect(screen.queryByText('No account found.')).toBeNull();
        expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
        expect(request).not.toHaveBeenCalled();

        expect(await screen.findByText('No account found.')).toBeTruthy();
    });
});

describe('PrioritiesPanel', () => {
    it('names one select per level and shows the default of Jira', async () => {
        request.mockResolvedValue([
            { id: '1', name: 'Highest' },
            { id: '2', name: 'High' },
        ]);

        renderWithProviders(
            <PrioritiesPanel scope={scope} connection={connection('jira')} />,
        );

        const high = await screen.findByRole('combobox', {
            name: 'Priority for High',
        });

        expect(high.textContent).toContain('Default (High)');
        expect(
            screen.getByRole('combobox', { name: 'Priority for Medium' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('combobox', { name: 'Priority for Low' }),
        ).toBeTruthy();
    });

    it('shows the saved priority of Linear', async () => {
        request.mockResolvedValue([
            { id: 0, name: 'No priority' },
            { id: 4, name: 'Low' },
        ]);
        const linear = connection('linear', {
            settings: { priorityMap: { low: 0 } },
        } as Partial<TeamIntegration>);

        renderWithProviders(
            <PrioritiesPanel scope={scope} connection={linear} />,
        );

        expect(
            (
                await screen.findByRole('combobox', {
                    name: 'Priority for Low',
                })
            ).textContent,
        ).toContain('No priority');
    });
});

describe('StatusMappingPanel', () => {
    beforeAll(() => {
        Element.prototype.hasPointerCapture = () => false;
        Element.prototype.setPointerCapture = () => {};
        Element.prototype.releasePointerCapture = () => {};
        Element.prototype.scrollIntoView = () => {};
    });

    const jira = connection('jira', {
        statusSync: true,
        settings: {
            statusMapping: {
                projects: {
                    PROJ: {
                        doneStatusIds: ['10002'],
                        startStatusId: null,
                        completeStatusId: null,
                        reopenStatusId: null,
                    },
                },
            },
        },
    } as Partial<TeamIntegration>);

    it('says what to do while nothing is linked yet', async () => {
        request.mockResolvedValue({ containers: [] });

        renderWithProviders(
            <StatusMappingPanel scope={scope} connection={jira} />,
        );

        expect(
            await screen.findByText(
                'Export an action item or import a task to map its statuses.',
            ),
        ).toBeTruthy();
    });

    it('opens the mapping of a project: done statuses and the two targets', async () => {
        request.mockResolvedValueOnce({ containers: ['PROJ'] });
        request.mockResolvedValueOnce({
            statuses: [
                { id: '10000', name: 'To Do', category: 'new' },
                { id: '10002', name: 'Done', category: 'done' },
                { id: '10005', name: 'Closed', category: 'done' },
            ],
        });

        renderWithProviders(
            <StatusMappingPanel scope={scope} connection={jira} />,
        );

        await userEvent.click(
            await screen.findByRole('button', { name: 'Edit mapping' }),
        );

        const done = await screen.findByRole('checkbox', { name: 'Done' });
        const closed = screen.getByRole('checkbox', { name: 'Closed' });

        expect(screen.getByText('PROJ')).toBeTruthy();
        expect(done.getAttribute('aria-checked')).toBe('true');
        expect(isDisabled(done)).toBe(true);
        expect(closed.getAttribute('aria-checked')).toBe('false');
        expect(
            screen.getByText('At least one status must count as done.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('combobox', { name: 'Complete to' }).textContent,
        ).toContain('Automatic');
        expect(
            screen.getByRole('combobox', { name: 'Reopen to' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Edit mapping' }),
        ).toBeNull();

        request.mockResolvedValueOnce(undefined);
        await userEvent.click(closed);

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Status mapping saved.'),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({
            status_mapping: {
                container: 'PROJ',
                done_status_ids: null,
                start_status_id: null,
                complete_status_id: null,
                reopen_status_id: null,
            },
        });
    });

    it('offers a start target before the two others, and saves it', async () => {
        request.mockResolvedValueOnce({ containers: ['PROJ'] });
        request.mockResolvedValueOnce({
            statuses: [
                { id: '10000', name: 'To Do', category: 'todo' },
                { id: '3', name: 'In Progress', category: 'in_progress' },
                { id: '10002', name: 'Done', category: 'done' },
            ],
        });

        renderWithProviders(
            <StatusMappingPanel scope={scope} connection={jira} />,
        );

        await userEvent.click(
            await screen.findByRole('button', { name: 'Edit mapping' }),
        );
        await screen.findByRole('combobox', { name: 'Start to' });

        expect(
            screen
                .getAllByRole('combobox')
                .map((combobox) => combobox.getAttribute('aria-label')),
        ).toEqual(['Start to', 'Complete to', 'Reopen to']);

        request.mockResolvedValueOnce(undefined);
        await userEvent.click(
            screen.getByRole('combobox', { name: 'Start to' }),
        );
        await userEvent.click(
            screen.getByRole('option', { name: 'In Progress' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Status mapping saved.'),
        );
        expect(request.mock.calls.at(-1)?.[0]).toEqual(
            TeamIntegrationsController.update({
                workspace: 'nordlys',
                team: 't1',
                integration: 'i1',
            }),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({
            status_mapping: {
                container: 'PROJ',
                done_status_ids: ['10002'],
                start_status_id: '3',
                complete_status_id: null,
                reopen_status_id: null,
            },
        });
    });

    it('saves the start state of a Linear team', async () => {
        const linear = connection('linear', {
            statusSync: true,
            settings: {
                statusMapping: {
                    teams: {
                        ENG: {
                            startStateId: null,
                            completeStateId: null,
                            reopenStateId: null,
                        },
                    },
                },
            },
        } as Partial<TeamIntegration>);
        request.mockResolvedValueOnce({ containers: ['ENG'] });
        request.mockResolvedValueOnce({
            statuses: [
                { id: 'st-todo', name: 'Todo', category: 'todo' },
                {
                    id: 'st-started',
                    name: 'In Progress',
                    category: 'in_progress',
                },
            ],
        });

        renderWithProviders(
            <StatusMappingPanel scope={scope} connection={linear} />,
        );

        await userEvent.click(
            await screen.findByRole('button', { name: 'Edit mapping' }),
        );
        request.mockResolvedValueOnce(undefined);
        await userEvent.click(
            await screen.findByRole('combobox', { name: 'Start to' }),
        );
        await userEvent.click(
            screen.getByRole('option', { name: 'In Progress' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Status mapping saved.'),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({
            status_mapping: {
                container: 'ENG',
                start_state_id: 'st-started',
                complete_state_id: null,
                reopen_state_id: null,
            },
        });
    });

    it('offers to try again when the projects cannot be loaded', async () => {
        request.mockRejectedValueOnce(new Error('down'));
        request.mockResolvedValueOnce({ containers: ['PROJ'] });

        renderWithProviders(
            <StatusMappingPanel scope={scope} connection={jira} />,
        );

        await userEvent.click(
            await screen.findByRole('button', { name: 'Try again' }),
        );

        expect(
            await screen.findByRole('button', { name: 'Edit mapping' }),
        ).toBeTruthy();
    });
});

describe('JiraDataCenterWebhookPanel', () => {
    const dataCenter = connection('jira_dc', { statusSync: true });

    it('shows the details on demand, each with its copy button, and confirms the registration', async () => {
        request.mockResolvedValueOnce({
            url: 'https://skrum.test/integrations/webhooks/jira-dc/i1/token',
            events: ['jira:issue_updated', 'jira:issue_deleted'],
            jql: 'project in ("OPS")',
            secret: 'dc-webhook-secret',
        });
        copy.mockResolvedValue(true);

        renderWithProviders(
            <JiraDataCenterWebhookPanel
                scope={scope}
                connection={dataCenter}
            />,
        );

        expect(screen.queryByText('Webhook URL')).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Show webhook details' }),
        );

        expect(await screen.findByText('Webhook URL')).toBeTruthy();
        expect(
            screen.getByText('jira:issue_updated, jira:issue_deleted'),
        ).toBeTruthy();
        expect(screen.getByText('project in ("OPS")')).toBeTruthy();
        expect(screen.getByText('dc-webhook-secret')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Show webhook details' }),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Copy Webhook URL' }),
        );

        expect(copy).toHaveBeenCalledWith(
            'https://skrum.test/integrations/webhooks/jira-dc/i1/token',
        );
        expect(
            screen.getByRole('button', { name: 'Copy Webhook URL' }),
        ).toBeTruthy();

        request.mockResolvedValueOnce(undefined);
        await userEvent.click(
            screen.getByRole('button', { name: "I've registered it" }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                'skrum now waits for the first event.',
            ),
        );
        expect(request.mock.calls.at(-1)?.[1]).toEqual({ registered: true });
    });

    it('no longer offers the confirmation once the webhook is registered', () => {
        const registered = connection('jira_dc', {
            statusSync: true,
            webhookStatus: 'pending',
        } as Partial<TeamIntegration>);

        renderWithProviders(
            <JiraDataCenterWebhookPanel
                scope={scope}
                connection={registered}
            />,
        );

        expect(
            screen.queryByRole('button', { name: "I've registered it" }),
        ).toBeNull();
    });
});

describe('GitHubPriorityLabels', () => {
    const github = connection('github', {
        settings: { priorityLabels: { high: 'P1' } },
    } as Partial<TeamIntegration>);

    it('saves the three labels, empty ones as none', async () => {
        request.mockResolvedValue(undefined);

        renderWithProviders(
            <GitHubPriorityLabels scope={scope} connection={github} />,
        );

        const high = screen.getByLabelText<HTMLInputElement>('High');

        expect(high.value).toBe('P1');
        expect(high.getAttribute('maxlength')).toBe('50');

        await userEvent.type(screen.getByLabelText('Low'), ' later ');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                'Priority labels saved.',
            ),
        );
        expect(request.mock.calls[0][1]).toEqual({
            priority_labels: { high: 'P1', medium: null, low: 'later' },
        });
    });

    it('shows a refusal under its field', async () => {
        request.mockRejectedValue(
            new RetroRequestError(422, 'Invalid.', {
                'priority_labels.medium': ['This label does not exist.'],
            }),
        );

        renderWithProviders(
            <GitHubPriorityLabels scope={scope} connection={github} />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(
                screen.getByLabelText('Medium').getAttribute('aria-invalid'),
            ).toBe('true'),
        );
        expect(screen.getByText('This label does not exist.')).toBeTruthy();
    });
});

describe('tracker cards', () => {
    it('offers both accesses while Jira is not connected', () => {
        renderProvider(<JiraIntegration card={card('jira')} scope={scope} />);

        const jira = providerPanel('Jira');

        expect(providerStatus('Jira')).toBe('Not connected');
        expect(linkTexts(jira)).toEqual([
            'Connect (read only)',
            'Connect (read and write)',
        ]);
        expect(
            within(jira)
                .getAllByRole('link')
                .map((link) => link.getAttribute('href')),
        ).toEqual([
            expect.stringContaining('/integrations/jira/connect?access=read'),
            expect.stringContaining('/integrations/jira/connect?access=write'),
        ]);
    });

    it('keeps the Jira row, its switch and the focus when the connection is removed from the switch', async () => {
        request.mockResolvedValue(undefined);

        const { rerender } = renderWithProviders(
            <JiraIntegration
                card={card('jira', connection('jira'))}
                scope={scope}
            />,
        );

        const toggle = screen.getByRole('switch', { name: 'Jira' });

        await userEvent.click(toggle);
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Disconnect',
            }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });

        rerender(<JiraIntegration card={card('jira')} scope={scope} />);

        expect(screen.getByRole('switch', { name: 'Jira' })).toBe(toggle);
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(document.activeElement).toBe(toggle);
    });

    it('keeps the sheet of Jira open when the connection is removed from its footer', async () => {
        request.mockResolvedValue(undefined);

        const { rerender } = renderProvider(
            <JiraIntegration
                card={card(
                    'jira',
                    connection('jira', {
                        status: 'setup_required',
                        statusLabel: 'Setup required',
                    }),
                )}
                scope={scope}
            />,
        );

        const panel = providerPanel('Jira');

        await userEvent.click(
            within(panel).getByRole('button', { name: 'Disconnect' }),
        );
        await userEvent.click(
            within(
                screen.getByRole('dialog', { name: 'Disconnect Jira?' }),
            ).getByRole('button', { name: 'Disconnect' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Jira disconnected.'),
        );

        rerender(<JiraIntegration card={card('jira')} scope={scope} />);

        expect(providerPanel('Jira')).toBe(panel);
        expect(linkTexts(panel)).toEqual([
            'Connect (read only)',
            'Connect (read and write)',
        ]);
    });

    it('keeps the sheet of Jira Data Center open once a token connects it', () => {
        const { rerender } = renderProvider(
            <JiraDataCenterIntegration
                card={card('jira_dc', null, ['pat'])}
                scope={scope}
            />,
        );

        const panel = providerPanel('Jira Data Center');
        const toggle = document.querySelector('[role="switch"]');

        rerender(
            <JiraDataCenterIntegration
                card={card(
                    'jira_dc',
                    connection('jira_dc', {
                        access: 'read',
                        settings: { authMethod: 'pat', tokenOwner: 'Ada' },
                    } as Partial<TeamIntegration>),
                    ['pat'],
                )}
                scope={scope}
            />,
        );

        expect(providerPanel('Jira Data Center')).toBe(panel);
        expect(document.querySelector('[role="switch"]')).toBe(toggle);
        expect(
            within(panel).getByRole('button', { name: 'Replace token' }),
        ).toBeTruthy();
    });

    it('asks for the Jira site while the setup is not finished, without the story points', () => {
        const setup = connection('jira', {
            status: 'setup_required',
            statusLabel: 'Setup required',
            settings: {
                sites: [
                    {
                        cloudId: 'c1',
                        name: 'Acme',
                        url: 'https://acme.atlassian.net',
                    },
                ],
            },
        } as Partial<TeamIntegration>);

        renderProvider(
            <JiraIntegration card={card('jira', setup)} scope={scope} />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Jira site' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Choose the Jira site this team uses:'),
        ).toBeTruthy();
        expect(screen.queryByText('Story points field')).toBeNull();
    });

    it('shows the site, the access and the upgrade of a read-only Jira', () => {
        const read = connection('jira', {
            access: 'read',
            settings: {
                siteName: 'Acme',
                siteUrl: 'https://acme.atlassian.net',
            },
        } as Partial<TeamIntegration>);

        renderProvider(
            <JiraIntegration card={card('jira', read)} scope={scope} />,
        );

        const jira = providerPanel('Jira');

        expect(
            within(jira)
                .getByRole('link', { name: 'Acme' })
                .getAttribute('href'),
        ).toBe('https://acme.atlassian.net');
        expect(jira.textContent).toContain('Read only');
        expect(
            within(jira).getByRole('link', {
                name: 'Upgrade to read and write',
            }),
        ).toBeTruthy();
        expect(jira.textContent).not.toContain('People');
        expect(
            within(jira).getByRole('switch', { name: 'Sync status' }),
        ).toBeTruthy();
    });

    it('says whom a Jira Data Center token acts as, in a warning', () => {
        const token = connection('jira_dc', {
            status: 'reconnect_required',
            statusLabel: 'Reconnect required',
            lastError: 'Jira no longer accepts this token.',
            settings: {
                authMethod: 'pat',
                tokenOwner: 'Jane Doe',
                tokenSavedAt: '2026-09-14T09:00:00Z',
                serverTitle: 'Acme Jira',
                baseUrl: 'https://jira.example.com',
                version: '8.20.1',
            },
        } as Partial<TeamIntegration>);

        renderProvider(
            <JiraDataCenterIntegration
                card={card('jira_dc', token, ['oauth', 'pat'])}
                scope={scope}
                statusSection={<p>status section</p>}
            />,
        );

        const dataCenter = providerPanel('Jira Data Center');
        const note = within(dataCenter).getByRole('note');

        expect(note.textContent).toContain('Acting as Jane Doe in Jira');
        expect(note.textContent).toContain(
            'This token acts as Jane Doe in Jira.',
        );
        expect(note.textContent).toContain('Token saved on Sep 14, 2026');
        expect(dataCenter.textContent).toContain('Personal access token');
        expect(dataCenter.textContent).toContain('8.20.1');
        expect(dataCenter.textContent).not.toContain('status section');
        expect(
            providerButtons(dataCenter).map((button) => button.textContent),
        ).toEqual(['Replace token', 'Remove token']);
        expect(
            within(dataCenter).queryByRole('link', { name: 'Reconnect' }),
        ).toBeNull();
    });

    it('offers the token as a link beside OAuth, and alone as the main action', () => {
        const { unmount } = renderProvider(
            <JiraDataCenterIntegration
                card={card('jira_dc', null, ['oauth', 'pat'])}
                scope={scope}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Older Jira server? Use a personal access token',
            }),
        ).toBeTruthy();
        expect(screen.getAllByRole('link')).toHaveLength(2);

        unmount();

        renderProvider(
            <JiraDataCenterIntegration
                card={card('jira_dc', null, ['pat'])}
                scope={scope}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Use a personal access token' }),
        ).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('shows the Linear workspace and its access', () => {
        const linear = connection('linear', {
            access: 'read',
            settings: { organizationName: 'Acme' },
        } as Partial<TeamIntegration>);

        renderProvider(
            <LinearIntegration card={card('linear', linear)} scope={scope} />,
        );

        const region = providerPanel('Linear');

        expect(region.textContent).toContain('Linear workspace');
        expect(region.textContent).toContain('Acme');
        expect(linkTexts(region)).toEqual([
            'Reconnect',
            'Upgrade to read and write',
        ]);
    });

    it('links the GitHub installation and says what a read-only one cannot do', () => {
        const github = connection('github', {
            access: 'read',
            settings: {
                accountLogin: 'acme',
                accountType: 'Organization',
                installationId: '4242',
            },
        } as Partial<TeamIntegration>);

        renderProvider(
            <GitHubIntegration
                card={card('github', github)}
                scope={scope}
                statusSection={<p>status section</p>}
            />,
        );

        const region = providerPanel('GitHub');

        expect(
            within(region)
                .getByRole('link', { name: 'acme' })
                .getAttribute('href'),
        ).toBe(
            'https://github.com/organizations/acme/settings/installations/4242',
        );
        expect(within(region).getByRole('note').textContent).toContain(
            'This installation can only read issues.',
        );
        expect(region.textContent).toContain('status section');
        expect(region.textContent).not.toContain('Priority labels');
        expect(
            within(region).getByRole('link', {
                name: 'Manage the installation',
            }),
        ).toBeTruthy();
    });

    it('offers to install the GitHub App while there is no installation', () => {
        renderProvider(
            <GitHubIntegration card={card('github')} scope={scope} />,
        );

        expect(linkTexts(providerPanel('GitHub'))).toEqual([
            'Install the GitHub App',
        ]);
    });
});
