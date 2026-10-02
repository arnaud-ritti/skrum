import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
});

describe('Popover', () => {
    it('opens on click with aria-expanded and aria-controls, and Escape returns focus', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>
                    <button type="button">Inside</button>
                </PopoverContent>
            </Popover>,
        );
        const trigger = screen.getByRole('button', { name: 'Open' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        await user.click(trigger);

        const content = await screen.findByRole('dialog');
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(trigger.getAttribute('aria-controls')).toBe(content.id);
        expect(content.getAttribute('data-slot')).toBe('popover-content');

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('stays open when its content rerenders with new data', async () => {
        const user = userEvent.setup();
        const view = (count: number) => (
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>{`count ${count}`}</PopoverContent>
            </Popover>
        );
        const { rerender } = renderWithProviders(view(1));

        await user.click(screen.getByRole('button', { name: 'Open' }));
        rerender(view(2));

        expect(await screen.findByText('count 2')).toBeTruthy();
    });

    it('opens by default and supports an anchor', () => {
        renderWithProviders(
            <Popover defaultOpen>
                <PopoverAnchor>
                    <span>Anchor</span>
                </PopoverAnchor>
                <PopoverContent>Body</PopoverContent>
            </Popover>,
        );

        expect(screen.getByText('Body')).toBeTruthy();
    });
});

describe('Tooltip', () => {
    it('shows on keyboard focus with role tooltip and an inverted surface', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <Tooltip>
                <TooltipTrigger>Help</TooltipTrigger>
                <TooltipContent>Next phase</TooltipContent>
            </Tooltip>,
        );

        await user.tab();

        const tooltip = await screen.findByRole('tooltip');
        expect(tooltip.textContent).toContain('Next phase');
        const surface = document.querySelector('[data-slot="tooltip-content"]');
        expect(surface?.className).toContain('bg-foreground');
        expect(surface?.className).toContain('text-background');
    });

    it('renders shortcut keys as Kbd', () => {
        renderWithProviders(
            <Tooltip defaultOpen>
                <TooltipTrigger>Help</TooltipTrigger>
                <TooltipContent shortcut={['⌘', '→']}>Next</TooltipContent>
            </Tooltip>,
        );

        const keys = document.querySelectorAll(
            '[data-slot="tooltip-content"] [data-slot="kbd"]',
        );

        expect(Array.from(keys).map((key) => key.textContent)).toEqual([
            '⌘',
            '→',
        ]);
    });

    it('renders no Kbd without shortcut', () => {
        renderWithProviders(
            <Tooltip defaultOpen>
                <TooltipTrigger>Help</TooltipTrigger>
                <TooltipContent shortcut={[]}>Next</TooltipContent>
            </Tooltip>,
        );

        expect(document.querySelector('[data-slot="kbd"]')).toBeNull();
    });
});

describe('Kbd', () => {
    it('renders a kbd element inside a group', () => {
        renderWithProviders(
            <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
            </KbdGroup>,
        );

        expect(document.querySelectorAll('kbd')).toHaveLength(2);
        expect(
            document.querySelector('[data-slot="kbd-group"]'),
        ).not.toBeNull();
    });
});
