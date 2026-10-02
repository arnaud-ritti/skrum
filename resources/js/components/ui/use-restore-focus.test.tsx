import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { CommandDialog, CommandPalette } from '@/components/ui/command';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView ??= () => {};
});

function Opener({
    children,
}: {
    children: (open: boolean, setOpen: (open: boolean) => void) => ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Opener
            </button>
            <button type="button">Other</button>
            {children(open, setOpen)}
        </>
    );
}

async function openThenEscape(role: 'dialog' | 'alertdialog') {
    const opener = screen.getByRole('button', { name: 'Opener' });

    opener.focus();
    fireEvent.click(opener);

    const overlay = await screen.findByRole(role);

    await waitFor(() => expect(overlay.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? overlay, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
}

describe('focus goes back to the opener of a controlled overlay', () => {
    it('ConfirmDialog', async () => {
        renderWithProviders(
            <Opener>
                {(open, setOpen) => (
                    <ConfirmDialog
                        open={open}
                        onOpenChange={setOpen}
                        title="Delete?"
                        description="This cannot be undone."
                        confirmLabel="Delete"
                        tone="destructive"
                        onConfirm={async () => {}}
                    />
                )}
            </Opener>,
        );

        await openThenEscape('alertdialog');
    });

    it('ConfirmDialog in its unavailable state', async () => {
        renderWithProviders(
            <Opener>
                {(open, setOpen) => (
                    <ConfirmDialog
                        open={open}
                        onOpenChange={setOpen}
                        title="Delete?"
                        description="This cannot be undone."
                        confirmLabel="Delete"
                        unavailableMessage="Already deleted."
                        onConfirm={async () => {}}
                    />
                )}
            </Opener>,
        );

        await openThenEscape('dialog');
    });

    it('FormDialog', async () => {
        renderWithProviders(
            <Opener>
                {(open, setOpen) => (
                    <FormDialog
                        open={open}
                        onOpenChange={setOpen}
                        title="New retro"
                        submitLabel="Create"
                        onSubmit={async () => {}}
                    >
                        <input aria-label="Name" name="name" />
                    </FormDialog>
                )}
            </Opener>,
        );

        await openThenEscape('dialog');
    });

    it('CommandPalette', async () => {
        renderWithProviders(
            <Opener>
                {(open, setOpen) => (
                    <CommandPalette
                        open={open}
                        onOpenChange={setOpen}
                        items={[
                            {
                                id: 'retro',
                                group: 'actions',
                                label: 'New retro',
                                icon: Plus,
                                onSelect: vi.fn(),
                            },
                        ]}
                    />
                )}
            </Opener>,
        );

        await openThenEscape('dialog');
    });
});

describe('CommandDialog defaults', () => {
    it('names and describes the dialog through the translator', () => {
        renderWithProviders(
            <CommandDialog open onOpenChange={() => {}}>
                <p>content</p>
            </CommandDialog>,
        );

        expect(
            screen.getByRole('dialog', { name: 'Command palette' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Search, run an action or open a session'),
        ).toBeTruthy();
    });
});
