import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DefaultWorkspaceCard } from './default-workspace-card';

const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    submit: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useState } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        useForm: (initial: Record<string, string | null>) => {
            const [data, setState] = useState(initial);

            return {
                data,
                setData: (key: string, value: string | null) =>
                    setState((current) => ({ ...current, [key]: value })),
                processing: form.processing,
                errors: form.errors,
                clearErrors: () => {},
                submit: (...parameters: unknown[]) =>
                    form.submit(data, ...parameters),
            };
        },
    };
});

const workspaces = [
    { id: '01990000-0000-7000-8000-000000000001', name: 'Aurora' },
    { id: '01990000-0000-7000-8000-000000000002', name: 'Zephyr' },
];

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    form.processing = false;
    form.errors = {};
    form.submit.mockReset();
});

function card(defaultWorkspaceId: string | null = workspaces[1].id) {
    return renderWithProviders(
        <DefaultWorkspaceCard
            defaultWorkspaceId={defaultWorkspaceId}
            workspaces={workspaces}
        />,
    );
}

function saveButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
}

describe('DefaultWorkspaceCard', () => {
    it('is the "New SSO accounts" region with its sentence', () => {
        card();

        expect(
            screen.getByRole('region', { name: 'New SSO accounts' })
                .textContent,
        ).toContain(
            'Accounts created through SSO without an invitation join this workspace as members and start by creating their team.',
        );
    });

    it('offers "None" then the workspaces in the order received, the one set preselected', async () => {
        card();

        const select = screen.getByRole('combobox', {
            name: 'Default workspace',
        });

        expect(select.textContent).toBe('Zephyr');

        await userEvent.click(select);

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['None', 'Aurora', 'Zephyr']);
    });

    it('preselects "None" when no workspace is set', () => {
        card(null);

        expect(
            screen.getByRole('combobox', { name: 'Default workspace' })
                .textContent,
        ).toBe('None');
    });

    it('keeps "Save" disabled until the value changes', async () => {
        card();

        expect(saveButton().disabled).toBe(true);

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Default workspace' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Aurora' }));

        expect(saveButton().disabled).toBe(false);
    });

    it('sends null for "None", as a PUT that keeps the scroll', async () => {
        card();

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Default workspace' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'None' }));
        await userEvent.click(saveButton());

        expect(form.submit).toHaveBeenCalledTimes(1);

        const [data, route, options] = form.submit.mock.calls[0];

        expect(data).toEqual({ default_workspace_id: null });
        expect(route).toMatchObject({
            url: '/admin/sign-in/default-workspace',
            method: 'put',
        });
        expect(options).toEqual({ preserveScroll: true });
    });

    it('sends the chosen workspace', async () => {
        card(null);

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Default workspace' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Aurora' }));
        await userEvent.click(saveButton());

        expect(form.submit.mock.calls[0][0]).toEqual({
            default_workspace_id: workspaces[0].id,
        });
    });

    it('shows the server error under the select', () => {
        form.errors = {
            default_workspace_id:
                'The selected default workspace id is invalid.',
        };
        card();

        const select = screen.getByRole('combobox', {
            name: 'Default workspace',
        });
        const error = screen.getByText(
            'The selected default workspace id is invalid.',
        );

        expect(select.getAttribute('aria-invalid')).toBe('true');
        expect(select.getAttribute('aria-describedby')).toBe(
            error.closest('[data-slot=field-error]')?.id,
        );
        expect(
            select.compareDocumentPosition(error) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
