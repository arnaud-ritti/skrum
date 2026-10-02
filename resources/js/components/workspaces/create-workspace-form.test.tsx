import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { renderWithProviders } from '@/test/render';

const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({ props: { translations: {} } }),
        Form: formMock(form),
    };
});

beforeEach(() => {
    form.processing = false;
    form.errors = {};
});

describe('CreateWorkspaceForm', () => {
    it('asks for the name under the title of the first onboarding step', () => {
        const { container } = renderWithProviders(<CreateWorkspaceForm />);
        const name = screen.getByLabelText(
            'Workspace name',
        ) as HTMLInputElement;

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Name your workspace',
            }),
        ).toBeTruthy();
        expect(container.textContent).toContain(
            'The workspace groups your teams, templates and members.',
        );
        expect(name.id).toBe('name');
        expect(name.name).toBe('name');
        expect(name.required).toBe(true);
        expect(name.maxLength).toBe(100);
        expect(container.querySelectorAll('input')).toHaveLength(1);
    });

    it('posts to the workspaces', () => {
        const { container } = renderWithProviders(<CreateWorkspaceForm />);
        const element = container.querySelector('form');

        expect(element?.getAttribute('action')).toBe('/workspaces');
        expect(element?.getAttribute('method')).toBe('post');
        expect(
            screen
                .getByRole('button', { name: 'Create workspace' })
                .getAttribute('type'),
        ).toBe('submit');
    });

    it('shows the error of the name on its field', () => {
        form.errors = { name: 'The name field is required.' };
        renderWithProviders(<CreateWorkspaceForm />);

        expect(
            document.querySelector('[data-slot="field-error"]')?.textContent,
        ).toBe('The name field is required.');
    });

    it('locks the button while the workspace is created', () => {
        form.processing = true;
        renderWithProviders(<CreateWorkspaceForm />);

        const button = document.querySelector(
            'button[data-loading="true"]',
        ) as HTMLButtonElement;

        expect(button.disabled).toBe(true);
        expect(button.textContent).toContain('Create workspace');
    });
});
