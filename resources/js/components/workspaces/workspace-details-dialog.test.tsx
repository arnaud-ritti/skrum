import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceDetailsDialog } from '@/components/workspaces/workspace-details-dialog';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { put: mocks.put },
}));

function open(description: string | null = 'Product teams of Nordlys') {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <WorkspaceDetailsDialog
            open
            onOpenChange={onOpenChange}
            workspace={{
                id: 'w1',
                name: 'Nordlys',
                slug: 'nordlys',
                description,
            }}
        />,
    );

    return { onOpenChange, dialog: screen.getByRole('dialog') };
}

async function submit(dialog: HTMLElement): Promise<VisitOptions> {
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    return mocks.put.mock.calls[0][2] as VisitOptions;
}

beforeEach(() => {
    mocks.put.mockReset();
});

describe('WorkspaceDetailsDialog', () => {
    it('shows the name and the description with their limits and the address line', () => {
        const { dialog } = open();
        const name = within(dialog).getByLabelText('Name') as HTMLInputElement;
        const description = within(dialog).getByLabelText(
            'Description',
        ) as HTMLTextAreaElement;

        expect(
            within(dialog).getByRole('heading', { name: 'Workspace' }),
        ).toBeTruthy();
        expect(name.id).toBe('workspace-name');
        expect(name.value).toBe('Nordlys');
        expect(name.required).toBe(true);
        expect(name.maxLength).toBe(100);
        expect(description.id).toBe('workspace-description');
        expect(description.value).toBe('Product teams of Nordlys');
        expect(within(dialog).getByText('24/200')).toBeTruthy();
        expect(
            within(dialog).getByText('The workspace address does not change.'),
        ).toBeTruthy();
        expect(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        ).toBeTruthy();
    });

    it('posts both fields to the details of the workspace and closes on success', async () => {
        const { dialog, onOpenChange } = open(null);

        await userEvent.clear(within(dialog).getByLabelText('Name'));
        await userEvent.type(within(dialog).getByLabelText('Name'), 'Aurora');
        await userEvent.type(
            within(dialog).getByLabelText('Description'),
            'Every product team',
        );

        const options = await submit(dialog);

        expect(mocks.put).toHaveBeenCalledTimes(1);
        expect(mocks.put.mock.calls[0][0]).toBe('/w/nordlys/details');
        expect(mocks.put.mock.calls[0][1]).toEqual({
            name: 'Aurora',
            description: 'Every product team',
        });

        await act(async () => {
            options.onSuccess();
        });

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows the server error under the name and stays open', async () => {
        const { dialog, onOpenChange } = open();

        await userEvent.clear(within(dialog).getByLabelText('Name'));
        await userEvent.type(within(dialog).getByLabelText('Name'), '  ');

        const options = await submit(dialog);

        await act(async () => {
            options.onError({ name: 'The name field is required.' });
        });

        const name = within(dialog).getByLabelText('Name');

        expect(name.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(name.getAttribute('aria-describedby') ?? '')
                ?.textContent,
        ).toBe('The name field is required.');
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('shows the server error under the description', async () => {
        const { dialog } = open();

        const options = await submit(dialog);

        await act(async () => {
            options.onError({
                description:
                    'The description field must not be greater than 200 characters.',
            });
        });

        const description = within(dialog).getByLabelText('Description');

        expect(description.getAttribute('aria-invalid')).toBe('true');
        expect(
            (description.getAttribute('aria-describedby') ?? '')
                .split(' ')
                .map((id) => document.getElementById(id)?.textContent),
        ).toContain(
            'The description field must not be greater than 200 characters.',
        );
    });

    it('shows a refusal on another field in the dialog', async () => {
        const { dialog } = open();

        const options = await submit(dialog);

        await act(async () => {
            options.onError({ slug: 'This address is already taken.' });
        });

        expect(dialog.textContent).toContain('This address is already taken.');
    });

    it('starts again from the saved details each time the parent opens it', async () => {
        const workspace = {
            id: 'w1',
            name: 'Nordlys',
            slug: 'nordlys',
            description: null,
        };
        const dialog = (isOpen: boolean, name = 'Nordlys') => (
            <WorkspaceDetailsDialog
                open={isOpen}
                onOpenChange={vi.fn()}
                workspace={{ ...workspace, name }}
            />
        );
        const view = renderWithProviders(dialog(true));

        await userEvent.clear(screen.getByLabelText('Name'));
        await userEvent.type(screen.getByLabelText('Name'), 'Draft');

        view.rerender(dialog(false));
        view.rerender(dialog(true, 'Nordlys Labs'));

        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
            'Nordlys Labs',
        );
    });
});
