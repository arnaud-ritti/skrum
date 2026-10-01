import { fireEvent, screen } from '@testing-library/react';
import { Plus, Settings } from 'lucide-react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/ui/command';
import type { CommandPaletteItem } from '@/components/ui/command';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView ??= () => {};
});

function makeItems(onSelect = vi.fn()): CommandPaletteItem[] {
    return [
        { id: 'retro', group: 'actions', label: 'New retro', icon: Plus, shortcut: ['⌘', 'N'], onSelect },
        { id: 'poker', group: 'actions', label: 'New poker session', icon: Plus, onSelect: vi.fn() },
        { id: 'settings', group: 'goto', label: 'Settings', icon: Settings, keywords: ['preferences'], meta: 'G S', onSelect: vi.fn() },
    ];
}

describe('CommandPalette', () => {
    it('renders nothing when closed', () => {
        renderWithProviders(<CommandPalette open={false} onOpenChange={vi.fn()} items={makeItems()} />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('lists grouped items with a result count', () => {
        renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} items={makeItems()} />);

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText('Actions')).toBeTruthy();
        expect(screen.getByText('Go to')).toBeTruthy();
        expect(screen.queryByText('Recent sessions')).toBeNull();
        expect(screen.getAllByRole('option')).toHaveLength(3);
        expect(screen.getByText('3 results')).toBeTruthy();
    });

    it('filters by label and keywords and highlights the match', () => {
        renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} items={makeItems()} />);
        const input = screen.getByRole('combobox');

        fireEvent.change(input, { target: { value: 'pref' } });
        expect(screen.getAllByRole('option')).toHaveLength(1);
        expect(screen.getByText('1 result')).toBeTruthy();

        fireEvent.change(input, { target: { value: 'poke' } });
        expect(screen.getByText('poke').tagName).toBe('STRONG');
    });

    it('shows the empty message with the query when nothing matches', () => {
        renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} items={makeItems()} />);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });

        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(screen.getByText('No results for “zzz”')).toBeTruthy();
    });

    it('shows a loading status instead of the items', () => {
        renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} items={makeItems()} loading />);

        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('runs the active item on Enter and closes', () => {
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();
        renderWithProviders(<CommandPalette open onOpenChange={onOpenChange} items={makeItems(onSelect)} />);

        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

        expect(onSelect).toHaveBeenCalledOnce();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('moves the active item with the arrow keys', () => {
        renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} items={makeItems()} />);
        const input = screen.getByRole('combobox');

        expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    });

    it('toggles on Ctrl+K and opens on / outside a field', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<CommandPalette open={false} onOpenChange={onOpenChange} items={makeItems()} />);

        fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
        expect(onOpenChange).toHaveBeenLastCalledWith(true);

        fireEvent.keyDown(document.body, { key: '/' });
        expect(onOpenChange).toHaveBeenCalledTimes(2);
    });

    it('ignores / while typing in a field', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(
            <>
                <input aria-label="field" />
                <CommandPalette open={false} onOpenChange={onOpenChange} items={makeItems()} />
            </>,
        );

        fireEvent.keyDown(screen.getByLabelText('field'), { key: '/' });

        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
