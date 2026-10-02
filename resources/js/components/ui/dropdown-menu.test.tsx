import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    CardMenu,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';

function setup(entries: MenuEntry[]) {
    const user = userEvent.setup();

    render(<CardMenu trigger={<button>Open</button>} entries={entries} />);

    return user;
}

describe('CardMenu', () => {
    it('opens with the trigger exposing menu semantics', async () => {
        const user = setup([
            { type: 'item', label: 'Edit', onSelect: vi.fn() },
        ]);
        const trigger = screen.getByRole('button', { name: 'Open' });

        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        await user.click(trigger);

        expect(screen.getByRole('menu')).not.toBeNull();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('calls onSelect and closes on Enter', async () => {
        const onSelect = vi.fn();
        const user = setup([{ type: 'item', label: 'Edit', onSelect }]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{Enter}');

        expect(onSelect).toHaveBeenCalledOnce();
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('shows a shortcut and closes on Escape', async () => {
        const user = setup([
            { type: 'item', label: 'Edit', shortcut: 'E', onSelect: vi.fn() },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByText('E')).not.toBeNull();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('disables an item, shows its reason and never selects it', async () => {
        const onSelect = vi.fn();
        const user = setup([
            {
                type: 'item',
                label: 'Edit',
                disabled: true,
                disabledReason: 'Inès is writing',
                onSelect,
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        const item = screen.getByRole('menuitem', { name: /Edit/ });

        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(within(item).getByText('Inès is writing')).not.toBeNull();

        await user.click(item);

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('gives a danger item an icon', async () => {
        const user = setup([
            { type: 'item', label: 'Delete', tone: 'danger', onSelect: vi.fn() },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        const item = screen.getByRole('menuitem', { name: 'Delete' });

        expect(item.getAttribute('data-variant')).toBe('destructive');
        expect(item.querySelector('svg')).not.toBeNull();
    });

    it('toggles a checkbox entry', async () => {
        const onCheckedChange = vi.fn();
        const user = setup([
            {
                type: 'checkbox',
                label: 'Authors',
                checked: false,
                onCheckedChange,
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.click(screen.getByRole('menuitemcheckbox', { name: 'Authors' }));

        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('marks the current radio and reports a change', async () => {
        const onValueChange = vi.fn();
        const user = setup([
            {
                type: 'radio',
                value: 'votes',
                onValueChange,
                items: [
                    { value: 'votes', label: 'Votes' },
                    { value: 'date', label: 'Date added' },
                ],
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByRole('menuitemradio', { name: 'Votes' }).getAttribute('aria-checked')).toBe('true');

        await user.click(screen.getByRole('menuitemradio', { name: 'Date added' }));

        expect(onValueChange).toHaveBeenCalledWith('date');
    });

    it('opens a sub-menu with ArrowRight and closes it with ArrowLeft', async () => {
        const user = setup([
            {
                type: 'sub',
                label: 'Move to',
                items: [{ type: 'item', label: 'Ideas', onSelect: vi.fn() }],
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        screen.getByRole('menuitem', { name: 'Move to' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(await screen.findByRole('menuitem', { name: 'Ideas' })).toBeTruthy();

        await user.keyboard('{ArrowLeft}');

        expect(screen.queryByRole('menuitem', { name: 'Ideas' })).toBeNull();
    });

    it('moves between items with the arrow keys', async () => {
        const user = setup([
            { type: 'item', label: 'Edit', onSelect: vi.fn() },
            { type: 'item', label: 'Duplicate', onSelect: vi.fn() },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowDown}');

        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Duplicate' }),
        );
    });
});

describe('DropdownMenu rows', () => {
    it('lets a two-line item grow instead of fixing its height', () => {
        render(
            <DropdownMenu open>
                <DropdownMenuTrigger>Open</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                        <span>Ada assigned you an action</span>
                        <span>Atlas · 2 hours ago</span>
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem checked>
                        Authors
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuRadioGroup value="votes">
                        <DropdownMenuRadioItem value="votes">
                            Votes
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                    </DropdownMenuSub>
                </DropdownMenuContent>
            </DropdownMenu>,
        );

        const rows = [
            screen.getByRole('menuitem', { name: /Ada assigned you/ }),
            screen.getByRole('menuitemcheckbox', { name: 'Authors' }),
            screen.getByRole('menuitemradio', { name: 'Votes' }),
            screen.getByRole('menuitem', { name: 'Move to' }),
        ];

        rows.forEach((row) => {
            const classes = row.className.split(/\s+/);

            expect(classes).toContain('min-h-8');
            expect(classes).toContain('py-1.5');
            expect(classes).not.toContain('h-8');
        });
        expect(rows[0].textContent).toContain('Atlas · 2 hours ago');
    });

    it('opens the card menu at once with defaultOpen', () => {
        render(
            <CardMenu
                defaultOpen
                trigger={<button>Open</button>}
                entries={[{ type: 'item', label: 'Edit', onSelect: vi.fn() }]}
            />,
        );

        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy();
    });
});
