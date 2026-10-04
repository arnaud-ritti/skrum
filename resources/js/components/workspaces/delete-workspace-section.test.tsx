import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteWorkspaceSection } from '@/components/workspaces/delete-workspace-section';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

const mocks = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { delete: mocks.delete },
}));

function section() {
    return renderWithProviders(
        <DeleteWorkspaceSection
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
        />,
    );
}

async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
        screen.getByRole('button', { name: 'Delete workspace' }),
    );

    return screen.getByRole('dialog', { name: 'Delete this workspace?' });
}

beforeEach(() => {
    mocks.delete.mockReset();
});

describe('DeleteWorkspaceSection', () => {
    it('says what is lost before anything is asked', () => {
        section();

        expect(
            screen.getByRole('heading', { level: 2, name: 'Delete workspace' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'This permanently deletes the workspace and everything in it: its teams and their sessions, boards and action items, the templates and the invitations.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('enables the deletion only once the name of the workspace is typed', async () => {
        section();

        const dialog = await openDialog();
        const submit = within(dialog).getByRole('button', {
            name: 'Delete workspace',
        }) as HTMLButtonElement;
        const field = dialog.querySelector(
            'input[name="confirmation"]',
        ) as HTMLInputElement;

        expect(submit.disabled).toBe(true);

        await userEvent.type(field, 'Nordly');
        expect(submit.disabled).toBe(true);

        await userEvent.type(field, '{Enter}');
        expect(mocks.delete).not.toHaveBeenCalled();

        await userEvent.type(field, 's');
        expect(submit.disabled).toBe(false);
    });

    it('deletes the workspace once confirmed', async () => {
        section();

        const dialog = await openDialog();

        await userEvent.type(
            dialog.querySelector('input[name="confirmation"]') as HTMLElement,
            'Nordlys',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete workspace' }),
        );

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys');

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess();
        });

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('shows the refusal of the server and keeps the dialog open with the typed name', async () => {
        section();

        const dialog = await openDialog();
        const field = dialog.querySelector(
            'input[name="confirmation"]',
        ) as HTMLInputElement;

        await userEvent.type(field, 'Nordlys');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete workspace' }),
        );
        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onError({
                workspace: 'This workspace still has a paid plan.',
            });
        });

        expect(
            screen.getByRole('dialog', { name: 'Delete this workspace?' })
                .textContent,
        ).toContain('This workspace still has a paid plan.');
        expect(field.value).toBe('Nordlys');
    });

    it('forgets the typed name when the dialog is closed', async () => {
        section();

        const dialog = await openDialog();

        await userEvent.type(
            dialog.querySelector('input[name="confirmation"]') as HTMLElement,
            'Nordlys',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );

        const reopened = await openDialog();

        expect(
            (
                reopened.querySelector(
                    'input[name="confirmation"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('');
        expect(mocks.delete).not.toHaveBeenCalled();
    });
});
