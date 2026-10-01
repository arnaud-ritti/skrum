import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RetroColumn } from '@/components/skrum/retro-column';
import type { RetroColumnProps } from '@/components/skrum/retro-column';
import { renderWithProviders } from '@/test/render';

function column(props: Partial<RetroColumnProps> = {}) {
    return (
        <RetroColumn
            id="col-1"
            title="What went well"
            color="moss"
            count={2}
            onAdd={() => {}}
            {...props}
        >
            <article data-slot="retro-card" tabIndex={0}>
                First
            </article>
            <article data-slot="retro-card" tabIndex={0}>
                Second
            </article>
        </RetroColumn>
    );
}

describe('RetroColumn', () => {
    it('labels the section with its title and announces the count', () => {
        renderWithProviders(column());

        expect(
            screen.getByRole('region', { name: 'What went well' }),
        ).toBeTruthy();
        expect(screen.getByText('2 cards')).toBeTruthy();
        expect(screen.getByRole('region').classList.contains('col-moss')).toBe(
            true,
        );
    });

    it('uses the singular for one card', () => {
        renderWithProviders(column({ count: 1 }));

        expect(screen.getByText('1 card')).toBeTruthy();
    });

    it('shows the empty hint when there are no cards', () => {
        renderWithProviders(
            <RetroColumn id="c" title="Ideas" color="sky" count={0} />,
        );

        expect(
            screen.getByText('No card yet. Be the first to write.'),
        ).toBeTruthy();
    });

    it('prefers a custom empty hint', () => {
        renderWithProviders(
            <RetroColumn
                id="c"
                title="Ideas"
                color="sky"
                count={0}
                emptyHint="Nothing here"
            />,
        );

        expect(screen.getByText('Nothing here')).toBeTruthy();
    });

    it('shows the drop zone as a status while a drag is over', () => {
        renderWithProviders(column({ isDropTarget: true }));

        expect(screen.getByRole('status').textContent).toContain('Drop here');
    });

    it('calls onAdd from the button', () => {
        const onAdd = vi.fn();

        renderWithProviders(column({ onAdd }));
        fireEvent.click(screen.getByRole('button', { name: 'Add a card' }));

        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('hides the add button and shows a lock when adding is disabled', () => {
        renderWithProviders(column({ canAdd: false }));

        expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();
        expect(
            screen.getByRole('img', { name: 'Adding cards is locked' }),
        ).toBeTruthy();
    });

    it('adds a card with N on the focused column but not while typing', () => {
        const onAdd = vi.fn();

        renderWithProviders(column({ onAdd }));
        const section = screen.getByRole('region');

        fireEvent.keyDown(section, { key: 'n' });
        expect(onAdd).toHaveBeenCalledTimes(1);

        const input = document.createElement('input');

        section.appendChild(input);
        fireEvent.keyDown(input, { key: 'n' });
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('does not add with N when adding is locked', () => {
        const onAdd = vi.fn();

        renderWithProviders(column({ onAdd, canAdd: false }));
        fireEvent.keyDown(screen.getByRole('region'), { key: 'n' });

        expect(onAdd).not.toHaveBeenCalled();
    });

    it('moves between cards with the arrow keys', () => {
        renderWithProviders(column());
        const section = screen.getByRole('region');

        fireEvent.keyDown(section, { key: 'ArrowDown' });
        expect(document.activeElement?.textContent).toBe('First');

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });
        expect(document.activeElement?.textContent).toBe('Second');
    });

    it('moves focus to the next column with ArrowRight', () => {
        renderWithProviders(
            <div>
                {column({ id: 'a' })}
                {column({ id: 'b', title: 'Other' })}
            </div>,
        );
        const [first, second] = screen.getAllByRole('region');

        fireEvent.keyDown(first, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(second);
    });

    it('renames through the menu and ignores empty or unchanged titles', async () => {
        const onRename = vi.fn();

        renderWithProviders(column({ onRename }));
        const trigger = screen.getByRole('button', { name: 'Column options' });

        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Rename' }),
        );

        const input = await screen.findByRole('textbox', {
            name: 'Column title',
        });

        fireEvent.change(input, { target: { value: '  ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onRename).not.toHaveBeenCalled();
    });

    it('commits a new title on Enter and cancels on Escape', async () => {
        const onRename = vi.fn();

        renderWithProviders(column({ onRename }));
        const open = async () => {
            fireEvent.pointerDown(
                screen.getByRole('button', { name: 'Column options' }),
                { button: 0, ctrlKey: false },
            );
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Rename' }),
            );

            return screen.findByRole('textbox', { name: 'Column title' });
        };

        const first = await open();

        fireEvent.change(first, { target: { value: 'Went great' } });
        fireEvent.keyDown(first, { key: 'Enter' });
        expect(onRename).toHaveBeenCalledWith('Went great');

        const second = await open();

        fireEvent.change(second, { target: { value: 'Nope' } });
        fireEvent.keyDown(second, { key: 'Escape' });
        expect(onRename).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('renders no menu without any facilitator callback', () => {
        renderWithProviders(column());

        expect(
            screen.queryByRole('button', { name: 'Column options' }),
        ).toBeNull();
    });

    it('sorts through the menu', async () => {
        const onSort = vi.fn();

        renderWithProviders(column({ onSort }));
        fireEvent.pointerDown(
            screen.getByRole('button', { name: 'Column options' }),
            { button: 0, ctrlKey: false },
        );
        fireEvent.keyDown(
            await screen.findByRole('menuitem', { name: 'Sort by' }),
            {
                key: 'ArrowRight',
            },
        );
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Sort by votes' }),
        );

        expect(onSort).toHaveBeenCalledWith('votes');
    });

    it('links the description to the title for assistive tech', () => {
        renderWithProviders(column({ description: 'Write what worked' }));

        expect(screen.getByText('Write what worked').id).not.toBe('');
    });
});
