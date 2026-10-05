import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    CardMenu,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
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

    it('lets the keyboard reach a disabled item with a reason, without selecting it', async () => {
        const onSelect = vi.fn();
        const user = setup([
            { type: 'item', label: 'Copy', onSelect: vi.fn() },
            {
                type: 'item',
                label: 'Edit',
                disabled: true,
                disabledReason: 'Inès is writing',
                onSelect,
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.keyboard('{ArrowDown}{ArrowDown}');

        const item = screen.getByRole('menuitem', { name: /Edit/ });

        expect(document.activeElement).toBe(item);

        await user.keyboard('{Enter}');

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('names a group of radios with its label', async () => {
        const user = setup([
            {
                type: 'radio',
                label: 'Sort by',
                value: 'votes',
                onValueChange: vi.fn(),
                items: [{ value: 'votes', label: 'Votes' }],
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByRole('group', { name: 'Sort by' })).toBeTruthy();
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

describe('defaults kept for existing menus', () => {
    it('keeps the compact minimum width unless the wide size is asked', async () => {
        const user = userEvent.setup();

        render(
            <DropdownMenu>
                <DropdownMenuTrigger>Colours</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Ada Lovelace</DropdownMenuLabel>
                    <DropdownMenuLabel variant="overline">
                        Sort by
                    </DropdownMenuLabel>
                    <DropdownMenuItem>Red</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>,
        );

        await user.click(screen.getByRole('button', { name: 'Colours' }));
        const menu = screen.getByRole('menu');

        expect(menu.getAttribute('data-size')).toBe('default');
        expect(menu.className.split(/\s+/)).toContain('min-w-32');
        expect(menu.className.split(/\s+/)).not.toContain('min-w-55');

        const name = screen.getByText('Ada Lovelace').className.split(/\s+/);

        expect(name).toContain('text-sm');
        expect(name).toContain('text-foreground');
        expect(name).not.toContain('text-muted-foreground');

        const overline = screen.getByText('Sort by').className.split(/\s+/);

        expect(overline).toContain('text-xs');
        expect(overline).toContain('text-muted-foreground');
    });

    it('gives the card menu the wide size and overline labels', async () => {
        const user = setup([
            { type: 'label', label: 'Sort by' },
            { type: 'item', label: 'Edit', onSelect: vi.fn() },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByRole('menu').getAttribute('data-size')).toBe('wide');
        expect(screen.getByText('Sort by').getAttribute('data-variant')).toBe(
            'overline',
        );
    });

    it('letter-spaces a shortcut but not a disabled reason', async () => {
        const user = setup([
            { type: 'item', label: 'Copy', shortcut: '⌘C', onSelect: vi.fn() },
            {
                type: 'item',
                label: 'Edit',
                disabled: true,
                disabledReason: 'Inès is writing',
                onSelect: vi.fn(),
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Open' }));

        expect(screen.getByText('⌘C').className.split(/\s+/)).toContain(
            'tracking-widest',
        );

        const reason = screen.getByText('Inès is writing').className.split(/\s+/);

        expect(reason).toContain('tracking-normal');
        expect(reason).not.toContain('tracking-widest');
    });
});

describe('CardMenu inline', () => {
    it('renders the menu open in the flow, next to its trigger', () => {
        const { container } = render(
            <CardMenu
                inline
                trigger={<button>Open</button>}
                entries={[
                    { type: 'item', label: 'Edit', onSelect: vi.fn() },
                    { type: 'item', label: 'Duplicate', onSelect: vi.fn() },
                ]}
            />,
        );

        const menu = screen.getByRole('menu');

        expect(container.contains(menu)).toBe(true);
        expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
        expect(document.body.style.pointerEvents).not.toBe('none');
    });

    it('stays open after Escape and still runs an item', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();

        render(
            <CardMenu
                inline
                trigger={<button>Open</button>}
                entries={[{ type: 'item', label: 'Edit', onSelect }]}
            />,
        );

        await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
        await user.keyboard('{Escape}');

        expect(onSelect).toHaveBeenCalledOnce();
        expect(screen.getByRole('menu')).not.toBeNull();
    });
});
