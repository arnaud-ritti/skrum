import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { renderWithProviders } from '@/test/render';

function Harness({
    initial = true,
    onOpenChange,
    showCloseButton,
}: {
    initial?: boolean;
    onOpenChange?: (open: boolean) => void;
    showCloseButton?: boolean;
}) {
    const [open, setOpen] = useState(initial);

    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                onOpenChange?.(next);
            }}
        >
            <DrawerContent showCloseButton={showCloseButton}>
                <DrawerHeader>
                    <DrawerTitle>Pick a card</DrawerTitle>
                    <DrawerDescription>Story 12</DrawerDescription>
                </DrawerHeader>
                <DrawerFooter>
                    <button type="button">Vote</button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

describe('Drawer', () => {
    it('renders a dialog named by its title with the description', () => {
        renderWithProviders(<Harness />);

        const dialog = screen.getByRole('dialog', { name: 'Pick a card' });
        expect(dialog.getAttribute('data-slot')).toBe('drawer-content');
        expect(screen.getByText('Story 12')).toBeTruthy();
    });

    it('renders nothing while closed', () => {
        renderWithProviders(<Harness initial={false} />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes from the close button, not only by gesture', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<Harness onOpenChange={onOpenChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes on Escape', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<Harness onOpenChange={onOpenChange} />);

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('hides the close button on request', () => {
        renderWithProviders(<Harness showCloseButton={false} />);

        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });
});
