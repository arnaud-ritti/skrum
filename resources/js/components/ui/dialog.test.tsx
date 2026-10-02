import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

function Example({ size }: { size?: 'default' | 'sm' }) {
    return (
        <Dialog>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent size={size}>
                <DialogHeader data-testid="header">
                    <DialogTitle>Rename the team</DialogTitle>
                    <DialogDescription>Pick a short name.</DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

describe('Dialog', () => {
    it('keeps the 32rem maximum width when the caller asks for nothing', async () => {
        const user = userEvent.setup();
        render(<Example />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        const dialog = screen.getByRole('dialog', { name: 'Rename the team' });

        expect(dialog.getAttribute('data-size')).toBe('default');
        expect(dialog.className.split(/\s+/)).toContain('sm:max-w-lg');
        expect(dialog.className.split(/\s+/)).not.toContain('sm:max-w-110');
    });

    it('offers the narrow width as a size', async () => {
        const user = userEvent.setup();
        render(<Example size="sm" />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        const dialog = screen.getByRole('dialog');

        expect(dialog.getAttribute('data-size')).toBe('sm');
        expect(dialog.className.split(/\s+/)).toContain(
            'data-[size=sm]:sm:max-w-110',
        );
    });

    it('keeps the header clear of the close button', async () => {
        const user = userEvent.setup();
        render(<Example />);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByTestId('header').className.split(/\s+/)).toContain(
            'pr-8',
        );
        expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
    });

    it('closes on Escape and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        render(<Example />);
        const trigger = screen.getByRole('button', { name: 'Open' });

        await user.click(trigger);
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
