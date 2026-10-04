import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStep } from '@/components/onboarding/workspace-step';
import { renderWithProviders } from '@/test/render';

type VisitOptions = { onError?: (errors: Record<string, string>) => void };

const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { put: mocks.put },
}));

beforeEach(() => {
    mocks.put.mockReset();
});

const locales = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
];

function Harness({
    workspace = null,
}: {
    workspace?: { name: string; locale: string | null } | null;
}) {
    const [name, setName] = useState(workspace?.name ?? '');

    return (
        <WorkspaceStep
            workspace={workspace}
            locales={locales}
            userLocale="fr"
            name={name}
            onNameChange={setName}
        />
    );
}

describe('WorkspaceStep', () => {
    it('asks for the name and the default language, preselected from the user', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Step 1 of 4')).toBeTruthy();
        expect(
            screen.getByRole('heading', { name: 'Name your workspace' }),
        ).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByLabelText('Workspace name'),
        );
        expect(screen.getByLabelText('Default language').textContent).toBe(
            'Français',
        );
        expect(screen.queryByText('Back')).toBeNull();
    });

    it('saves the name and the language with "Continue"', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(screen.getByLabelText('Workspace name'), {
            target: { value: 'Nordlys' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(mocks.put).toHaveBeenCalledOnce();
        expect(mocks.put.mock.calls[0][0]).toBe('/onboarding/workspace');
        expect(mocks.put.mock.calls[0][1]).toEqual({
            name: 'Nordlys',
            locale: 'fr',
        });
    });

    it('keeps the saved language after a "Back"', () => {
        renderWithProviders(
            <Harness workspace={{ name: 'Nordlys', locale: 'en' }} />,
        );

        expect(screen.getByLabelText('Workspace name')).toHaveProperty(
            'value',
            'Nordlys',
        );
        expect(screen.getByLabelText('Default language').textContent).toBe(
            'English',
        );
    });

    it('shows the server error under the name', () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({ name: 'The name field is required.' }),
        );
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByText('The name field is required.')).toBeTruthy();
        expect(
            screen
                .getByLabelText('Workspace name')
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });
});
