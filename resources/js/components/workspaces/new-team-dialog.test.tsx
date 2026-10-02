import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTeamDialog } from '@/components/workspaces/new-team-dialog';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { post: mocks.post },
}));

function open() {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <NewTeamDialog
            open
            onOpenChange={onOpenChange}
            workspaceSlug="nordlys"
        />,
    );

    return { onOpenChange, dialog: screen.getByRole('dialog') };
}

beforeEach(() => {
    mocks.post.mockReset();
});

describe('NewTeamDialog', () => {
    it('keeps the field and the submit of the old inline form', () => {
        const { dialog } = open();
        const field = within(dialog).getByLabelText(
            'New team name',
        ) as HTMLInputElement;

        expect(
            within(dialog).getByRole('heading', { name: 'New team' }),
        ).toBeTruthy();
        expect(field.name).toBe('name');
        expect(field.required).toBe(true);
        expect(field.maxLength).toBe(100);
        expect(
            within(dialog).getByRole('button', { name: 'Create team' }),
        ).toBeTruthy();
    });

    it('posts the name to the teams of the workspace and closes on success', async () => {
        const { dialog, onOpenChange } = open();

        await userEvent.type(
            within(dialog).getByLabelText('New team name'),
            'Atlas',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Create team' }),
        );

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/teams');
        expect(mocks.post.mock.calls[0][1]).toEqual({ name: 'Atlas' });

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onSuccess();
        });

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows the validation message of the server and stays open', async () => {
        const { dialog, onOpenChange } = open();

        await userEvent.type(
            within(dialog).getByLabelText('New team name'),
            'Atlas',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Create team' }),
        );
        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onError({
                name: 'The name field must not be greater than 100 characters.',
            });
        });

        await waitFor(() =>
            expect(within(dialog).getByRole('alert').textContent).toBe(
                'The name field must not be greater than 100 characters.',
            ),
        );
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
});
