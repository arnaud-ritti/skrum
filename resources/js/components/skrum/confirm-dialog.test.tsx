import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DoorOpenIcon, UsersIcon } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

function deferred() {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((done) => {
        resolve = done;
    });

    return { promise, resolve };
}

describe('Dialog primitive', () => {
    it('keeps the data-slot attributes and the default close button', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Title</DialogTitle>
                    <DialogDescription>Body</DialogDescription>
                </DialogContent>
            </Dialog>,
        );

        expect(
            document.querySelector('[data-slot="dialog-content"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="dialog-overlay"]'),
        ).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });

    it('hides the close button on request', () => {
        render(
            <Dialog open>
                <DialogContent showCloseButton={false}>
                    <DialogTitle>Title</DialogTitle>
                    <DialogDescription>Body</DialogDescription>
                </DialogContent>
            </Dialog>,
        );

        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });
});

describe('ConfirmDialog', () => {
    const base = {
        open: true,
        title: 'Delete "Sprint 42"?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
    };

    it('is an alertdialog named by its title and described by its description', () => {
        render(
            <ConfirmDialog
                {...base}
                onOpenChange={() => {}}
                onConfirm={async () => {}}
            />,
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete "Sprint 42"?',
        });

        expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
        expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    });

    it('focuses Cancel first when destructive', async () => {
        render(
            <ConfirmDialog
                {...base}
                tone="destructive"
                onOpenChange={() => {}}
                onConfirm={async () => {}}
            />,
        );

        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Cancel' }),
            ),
        );
    });

    it('names the cancel button on request', () => {
        render(
            <ConfirmDialog
                {...base}
                cancelLabel="Keep exporting"
                onOpenChange={() => {}}
                onConfirm={async () => {}}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Keep exporting' }),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('renders the consequences', () => {
        render(
            <ConfirmDialog
                {...base}
                consequences={[{ icon: UsersIcon, label: '12 cards lost' }]}
                onOpenChange={() => {}}
                onConfirm={async () => {}}
            />,
        );

        expect(screen.getByText('12 cards lost')).toBeTruthy();
    });

    it('does not close on an outside click', async () => {
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                {...base}
                onOpenChange={onOpenChange}
                onConfirm={async () => {}}
            />,
        );

        const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;

        await userEvent.click(overlay);

        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                {...base}
                onOpenChange={onOpenChange}
                onConfirm={async () => {}}
            />,
        );

        await userEvent.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('locks the footer and ignores Escape while confirming, then closes', async () => {
        const pending = deferred();
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                {...base}
                tone="destructive"
                onOpenChange={onOpenChange}
                onConfirm={() => pending.promise}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(
            (
                screen.getByRole('button', {
                    name: 'Cancel',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(screen.getByRole('status')).toBeTruthy();

        await userEvent.keyboard('{Escape}');
        expect(onOpenChange).not.toHaveBeenCalled();

        pending.resolve();

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('stays open and unlocks when the confirmation fails', async () => {
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                {...base}
                onOpenChange={onOpenChange}
                onConfirm={() => Promise.reject(new Error('nope'))}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(
                (
                    screen.getByRole('button', {
                        name: 'Delete',
                    }) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        );
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('shows the server error after a rejected confirmation', async () => {
        const onOpenChange = vi.fn();
        const props = {
            ...base,
            onOpenChange,
            onConfirm: () => Promise.reject(new Error('nope')),
        };
        const { rerender } = render(<ConfirmDialog {...props} />);

        expect(screen.queryByRole('alert')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        rerender(
            <ConfirmDialog
                {...props}
                error="The session is locked by its facilitator."
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The session is locked by its facilitator.',
        );
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('swaps its content for a single Close button when unavailable', async () => {
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                {...base}
                unavailableMessage="Deleted by another facilitator."
                onOpenChange={onOpenChange}
                onConfirm={async () => {}}
            />,
        );

        expect(
            screen.getByText('Deleted by another facilitator.'),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

describe('FormDialog', () => {
    it('submits the form data on Enter and closes', async () => {
        const onSubmit = vi.fn(async () => {});
        const onOpenChange = vi.fn();

        render(
            <FormDialog
                open
                onOpenChange={onOpenChange}
                title="New retro"
                submitLabel="Create"
                onSubmit={onSubmit}
            >
                <input aria-label="Name" name="name" />
            </FormDialog>,
        );

        expect(screen.getByRole('dialog', { name: 'New retro' })).toBeTruthy();

        await userEvent.type(screen.getByLabelText('Name'), 'Sprint{Enter}');

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(
            (onSubmit.mock.calls[0] as unknown as [FormData])[0].get('name'),
        ).toBe('Sprint');
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('does not submit twice while pending and blocks Escape', async () => {
        const pending = deferred();
        const onSubmit = vi.fn(() => pending.promise);
        const onOpenChange = vi.fn();

        render(
            <FormDialog
                open
                onOpenChange={onOpenChange}
                title="New retro"
                submitLabel="Create"
                onSubmit={onSubmit}
            >
                <input aria-label="Name" name="name" />
            </FormDialog>,
        );

        const form = document.querySelector('form')!;

        fireEvent.submit(form);
        fireEvent.submit(form);
        await userEvent.keyboard('{Escape}');

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onOpenChange).not.toHaveBeenCalled();

        pending.resolve();
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows a server error and a destructive submit with an icon and a label', () => {
        const { rerender } = render(
            <FormDialog
                open
                onOpenChange={() => {}}
                title="Delete the team"
                submitLabel="Delete"
                onSubmit={async () => {}}
            >
                <input aria-label="Team name" name="name" />
            </FormDialog>,
        );

        const submit = () => screen.getByRole('button', { name: 'Delete' });

        expect(screen.queryByRole('alert')).toBeNull();
        expect(submit().querySelector('svg')).toBeNull();

        rerender(
            <FormDialog
                open
                onOpenChange={() => {}}
                title="Delete the team"
                submitLabel="Delete"
                tone="destructive"
                error="The name does not match."
                onSubmit={async () => {}}
            >
                <input aria-label="Team name" name="name" />
            </FormDialog>,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The name does not match.',
        );
        expect(submit().querySelector('svg')).not.toBeNull();
        expect(submit().textContent).toBe('Delete');
        expect(submit().getAttribute('data-variant') ?? 'destructive').toBe(
            'destructive',
        );
    });

    it('shows the given icon on its submit button in place of the bin', () => {
        render(
            <FormDialog
                open
                onOpenChange={() => {}}
                title="Leave Nordlys?"
                submitLabel="Leave Nordlys"
                submitIcon={DoorOpenIcon}
                tone="destructive"
                onSubmit={async () => {}}
            >
                <input aria-label="Workspace name" name="name" />
            </FormDialog>,
        );

        const submit = screen.getByRole('button', { name: 'Leave Nordlys' });

        expect(submit.querySelector('svg.lucide-door-open')).not.toBeNull();
        expect(submit.querySelector('svg.lucide-trash-2')).toBeNull();
        expect(submit.textContent).toBe('Leave Nordlys');
    });

    it('puts the given test hook on its submit button', () => {
        render(
            <FormDialog
                open
                onOpenChange={vi.fn()}
                title="Delete account"
                submitLabel="Delete account"
                submitTest="confirm-delete-user-button"
                onSubmit={vi.fn()}
            >
                <input name="password" aria-label="Password" />
            </FormDialog>,
        );

        expect(
            screen
                .getByRole('button', { name: 'Delete account' })
                .getAttribute('data-test'),
        ).toBe('confirm-delete-user-button');
    });

    it("holds the label of a footer button as the button's own text, icon or not", () => {
        render(
            <FormDialog
                open
                onOpenChange={() => {}}
                title="Delete the template"
                submitLabel="Delete"
                tone="destructive"
                onSubmit={async () => {}}
            >
                <input aria-label="Name" name="name" />
            </FormDialog>,
        );

        const ownText = (name: string): string[] =>
            Array.from(screen.getByRole('button', { name }).childNodes)
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent ?? '');

        expect(ownText('Cancel')).toEqual(['Cancel']);
        expect(ownText('Delete')).toEqual(['Delete']);
        expect(
            screen.getByRole('button', { name: 'Delete' }).className,
        ).toContain('truncate');
    });

    it('keeps the submit button disabled, and ignores Enter, until the form is complete', async () => {
        const onSubmit = vi.fn(async () => {});
        const form = (complete: boolean) => (
            <FormDialog
                open
                onOpenChange={() => {}}
                title="Hand over facilitation"
                submitLabel="Hand over"
                submitDisabled={!complete}
                onSubmit={onSubmit}
            >
                <input aria-label="Name" name="name" />
            </FormDialog>
        );

        const { rerender } = render(form(false));
        const submit = () =>
            screen.getByRole('button', {
                name: 'Hand over',
            }) as HTMLButtonElement;

        expect(submit().disabled).toBe(true);

        await userEvent.type(screen.getByLabelText('Name'), '{Enter}');

        expect(onSubmit).not.toHaveBeenCalled();

        rerender(form(true));

        expect(submit().disabled).toBe(false);

        await userEvent.click(submit());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });

    it('has no submit button and closes on Cancel when it cannot be submitted', async () => {
        const onOpenChange = vi.fn();

        render(
            <FormDialog
                open
                onOpenChange={onOpenChange}
                title="Hand over facilitation"
            >
                <p>No one else can facilitate this board yet.</p>
            </FormDialog>,
        );

        const dialog = screen.getByRole('dialog');

        expect(dialog.textContent).toContain(
            'No one else can facilitate this board yet.',
        );
        expect(dialog.querySelector('button[type="submit"]')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
