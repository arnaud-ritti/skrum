import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { NewApiToken } from '@/types';
import { CreateTokenForm } from './create-token-form';
import { describedBy } from './fixtures';

type SubmitOptions = { preserveScroll?: boolean; onSuccess?: () => void };

const form = vi.hoisted(() => ({
    errors: {} as Record<string, string>,
    processing: false,
    submit: vi.fn(),
    reset: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useState } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({ props: { translations: {} } }),
        useForm: (initial: Record<string, unknown>) => {
            const [data, setState] = useState(initial);

            return {
                data,
                setData: (key: string, value: unknown) =>
                    setState((current) => ({ ...current, [key]: value })),
                errors: form.errors,
                processing: form.processing,
                submit: (...parameters: unknown[]) =>
                    form.submit(data, ...parameters),
                reset: () => {
                    form.reset();
                    setState(initial);
                },
            };
        },
    };
});

const teamGroups = [
    {
        workspace: { id: 'w1', name: 'Nordlys' },
        teams: [
            { id: 't1', name: 'Atlas' },
            { id: 't2', name: 'Borealis' },
        ],
    },
];

const expirationOptions = [
    { value: '30_days' as const, label: '30 days' },
    { value: '90_days' as const, label: '90 days' },
    { value: 'never' as const, label: 'Never' },
];

const created: NewApiToken = { name: 'Claude', plainText: '7|skrum_abc' };

beforeEach(() => {
    form.errors = {};
    form.processing = false;
    form.submit.mockReset();
    form.reset.mockReset();
});

function createForm(newToken: NewApiToken | null = null, onDone = vi.fn()) {
    renderWithProviders(
        <CreateTokenForm
            teamGroups={teamGroups}
            expirationOptions={expirationOptions}
            defaultExpiration="90_days"
            mcpUrl="https://skrum.test/mcp"
            newToken={newToken}
            onDone={onDone}
        />,
    );

    return onDone;
}

describe('CreateTokenForm', () => {
    it('is a form of the page, in the "API tokens" region, not a dialog', () => {
        createForm();

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            screen.getByRole('region', { name: 'API tokens' }).textContent,
        ).toContain(
            'Connect an AI assistant that supports MCP to skrum with a personal token.',
        );

        const region = within(
            screen.getByRole('form', { name: 'New API token' }),
        );

        expect(region.getByLabelText('Token name').getAttribute('id')).toBe(
            'token-name',
        );
        expect(
            region.getByLabelText('Token name').getAttribute('maxlength'),
        ).toBe('60');
        expect(region.getByLabelText('Expiration').textContent).toContain(
            '90 days',
        );
        expect(region.getByLabelText('Team').textContent).toContain(
            'All my teams',
        );
        expect(
            region
                .getByRole('button', { name: 'Create token' })
                .getAttribute('type'),
        ).toBe('submit');
    });

    it('lists the scopes with their code: reading is always granted', () => {
        createForm();

        const scopes = within(screen.getByRole('group', { name: 'Scopes' }));
        const read = scopes.getByRole('checkbox', { name: 'mcp:read Read' });

        expect(read.getAttribute('id')).toBe('scope-read');
        expect(read.getAttribute('aria-checked')).toBe('true');
        expect((read as HTMLButtonElement).disabled).toBe(true);
        expect(
            scopes
                .getByRole('checkbox', { name: 'mcp:write Create and update' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            scopes
                .getByRole('checkbox', {
                    name: /mcp:delete Delete my messages/,
                })
                .getAttribute('id'),
        ).toBe('scope-delete');
        expect(
            scopes.getByText('Lets the client delete messages you wrote.'),
        ).toBeTruthy();
    });

    it('sends the name, the ticked scopes, no team and the default expiration', async () => {
        createForm();

        await userEvent.type(screen.getByLabelText('Token name'), 'Claude');
        await userEvent.click(document.getElementById('scope-write')!);
        await userEvent.click(document.getElementById('scope-delete')!);
        await userEvent.click(document.getElementById('scope-delete')!);
        await userEvent.click(
            screen.getByRole('button', { name: 'Create token' }),
        );

        expect(form.submit).toHaveBeenCalledOnce();

        const [data, action, options] = form.submit.mock.calls[0] as [
            Record<string, unknown>,
            { url: string; method: string },
            SubmitOptions,
        ];

        expect(data).toEqual({
            name: 'Claude',
            scopes: ['mcp:write'],
            team_id: null,
            expiration: '90_days',
        });
        expect(action.method).toBe('post');
        expect(action.url).toContain('/settings/api-tokens');
        expect(options.preserveScroll).toBe(true);
    });

    it('empties the form once the token is created', async () => {
        createForm();

        await userEvent.type(screen.getByLabelText('Token name'), 'Claude');
        await userEvent.click(
            screen.getByRole('button', { name: 'Create token' }),
        );

        (form.submit.mock.calls[0][2] as SubmitOptions).onSuccess?.();

        expect(form.reset).toHaveBeenCalledOnce();
    });

    it('shows a refused value under its field, which takes the focus', () => {
        form.errors = {
            name: 'You already have a token with this name.',
            'scopes.0': 'The selected scope is invalid.',
            team_id: 'Choose a team you can see.',
        };

        createForm();

        const name = screen.getByLabelText('Token name');

        expect(name.getAttribute('aria-invalid')).toBe('true');
        expect(describedBy(name)).toBe(
            'You already have a token with this name.',
        );
        expect(document.activeElement).toBe(name);
        expect(
            screen.getByRole('group', { name: 'Scopes' }).textContent,
        ).toContain('The selected scope is invalid.');
        expect(describedBy(screen.getByLabelText('Team'))).toBe(
            'Choose a team you can see.',
        );
    });

    it('waits while the token is being created', () => {
        form.processing = true;

        createForm();

        expect(
            (
                screen.getByRole('button', {
                    name: 'Create token',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('replaces its footer with the copy-once panel until "Done"', async () => {
        const onDone = createForm(created);

        expect(
            screen.queryByRole('button', { name: 'Create token' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="settings-card-footer"]'),
        ).toBeNull();
        expect(
            (
                screen.getByRole('textbox', {
                    name: 'API token',
                }) as HTMLInputElement
            ).value,
        ).toBe(created.plainText);
        expect(document.activeElement).toBe(
            screen.getByRole('textbox', { name: 'API token' }),
        );

        await userEvent.type(screen.getByLabelText('Token name'), 'x{Enter}');

        expect(form.submit).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Done' }));

        expect(onDone).toHaveBeenCalledOnce();
    });
});
