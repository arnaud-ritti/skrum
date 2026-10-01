import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetProperties,
    SheetProperty,
    SheetTitle,
} from '@/components/ui/sheet';
import { renderWithProviders } from '@/test/render';

function Harness({
    side,
    showCloseButton,
    onOpenChange,
}: {
    side?: 'left' | 'right';
    showCloseButton?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [open, setOpen] = useState(true);

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                onOpenChange?.(next);
            }}
        >
            <SheetContent side={side} showCloseButton={showCloseButton}>
                <SheetHeader>
                    <SheetTitle>Action details</SheetTitle>
                    <SheetDescription>Edit this action</SheetDescription>
                </SheetHeader>
                <SheetBody>
                    <SheetProperties>
                        <SheetProperty label="Owner">Ada</SheetProperty>
                    </SheetProperties>
                </SheetBody>
                <SheetFooter>
                    <button type="button">Save</button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

describe('Sheet', () => {
    it('is a modal dialog labelled by its title', () => {
        renderWithProviders(<Harness />);

        const dialog = screen.getByRole('dialog', { name: 'Action details' });
        expect(dialog.getAttribute('data-slot')).toBe('sheet-content');
        expect(screen.getByText('Edit this action')).toBeTruthy();
    });

    it('closes with Escape', async () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<Harness onOpenChange={onOpenChange} />);

        await userEvent.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes with the named close button', async () => {
        renderWithProviders(<Harness />);

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('can hide the close button', () => {
        renderWithProviders(<Harness showCloseButton={false} />);

        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });

    it('renders properties as a definition list', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Owner').closest('dt')).toBeTruthy();
        expect(screen.getByText('Ada').closest('dd')).toBeTruthy();
    });

    it('keeps the close button a direct child of the content for the sidebar', () => {
        renderWithProviders(<Harness side="left" />);

        const dialog = screen.getByRole('dialog');
        const close = screen.getByRole('button', { name: 'Close' });
        expect(close.parentElement).toBe(dialog);
    });
});
