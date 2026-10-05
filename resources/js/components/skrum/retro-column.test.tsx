import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { createRef } from 'react';
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
    it('shows the composer of the host in place of the "Add a card" button, and only while cards can be added', () => {
        const composer = <form aria-label="Composer" />;
        const { rerender } = renderWithProviders(column({ composer }));

        expect(screen.getByRole('form', { name: 'Composer' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();

        rerender(column({ composer, canAdd: false }));

        expect(screen.queryByRole('form', { name: 'Composer' })).toBeNull();
    });

    it('still calls onAdd with N when the host has a composer', () => {
        const onAdd = vi.fn();

        renderWithProviders(column({ onAdd, composer: <form /> }));
        fireEvent.keyDown(screen.getByRole('region'), { key: 'n' });

        expect(onAdd).toHaveBeenCalledTimes(1);
    });

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

    it('hides the add button without a lock icon when adding is disabled', () => {
        renderWithProviders(column({ canAdd: false }));

        expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();
        expect(
            document.querySelector('[data-slot="retro-column-lock"]'),
        ).toBeNull();
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
        const trigger = screen.getByRole('button', { name: 'Column menu' });

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

        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Rename' }),
        );

        const again = await screen.findByRole('textbox', {
            name: 'Column title',
        });

        fireEvent.change(again, { target: { value: ' What went well ' } });
        fireEvent.keyDown(again, { key: 'Enter' });
        expect(onRename).not.toHaveBeenCalled();
    });

    it('commits a new title on Enter and cancels on Escape', async () => {
        const onRename = vi.fn();

        renderWithProviders(column({ onRename }));
        const open = async () => {
            fireEvent.pointerDown(
                screen.getByRole('button', { name: 'Column menu' }),
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
            screen.queryByRole('button', { name: 'Column menu' }),
        ).toBeNull();
    });

    it('toggles the sort by votes and keeps the browser-suite hook', () => {
        const onSortByVotesChange = vi.fn();
        const { rerender, container } = renderWithProviders(
            column({ onSortByVotesChange, sortedByVotes: true }),
        );
        const toggle = container.querySelector<HTMLElement>(
            '[data-test="retro-sort-by-votes"]',
        );

        expect(toggle?.getAttribute('aria-pressed')).toBe('true');
        expect(toggle?.textContent).toBe('Sort by votes');

        fireEvent.click(toggle as HTMLElement);
        expect(onSortByVotesChange).toHaveBeenCalledWith(false);

        rerender(column({ onSortByVotesChange, sortedByVotes: false }));
        expect(
            screen
                .getByRole('button', { name: 'Sort by votes' })
                .getAttribute('aria-pressed'),
        ).toBe('false');

        rerender(column());
        expect(
            container.querySelector('[data-test="retro-sort-by-votes"]'),
        ).toBeNull();
    });

    it('shows the description under the title and describes the column with it', () => {
        const { rerender } = renderWithProviders(
            column({ description: 'Write what worked' }),
        );
        const description = screen.getByText('Write what worked');

        expect(description.id).not.toBe('');
        expect(
            screen.getByRole('region').getAttribute('aria-describedby'),
        ).toBe(description.id);

        rerender(column({ description: null }));

        expect(
            screen.getByRole('region').getAttribute('aria-describedby'),
        ).toBeNull();
    });

    describe('column menu', () => {
        const openMenu = () =>
            fireEvent.pointerDown(
                screen.getByRole('button', { name: 'Column menu' }),
                { button: 0, ctrlKey: false },
            );
        const menuClosed = () =>
            waitFor(() => {
                expect(screen.queryByRole('menu')).toBeNull();
            });
        const dialogClosed = () =>
            waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
                expect(screen.queryByRole('alertdialog')).toBeNull();
            });

        it('keeps the rename editor open after the menu has closed', async () => {
            const onRename = vi.fn();

            renderWithProviders(column({ onRename }));
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Rename' }),
            );
            await menuClosed();

            const input = await screen.findByRole('textbox', {
                name: 'Column title',
            });

            await waitFor(() => {
                expect(document.activeElement).toBe(input);
            });
            expect(onRename).not.toHaveBeenCalled();

            fireEvent.change(input, { target: { value: 'Went great' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(onRename).toHaveBeenCalledWith('Went great');
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Column menu' }),
            );
        });

        it('returns focus to the menu button when a rename is cancelled', async () => {
            renderWithProviders(column({ onRename: vi.fn() }));
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Rename' }),
            );
            await screen.findByRole('textbox', { name: 'Column title' });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

            expect(screen.queryByRole('textbox')).toBeNull();
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Column menu' }),
            );
        });

        it('commits a rename on blur without taking focus back', async () => {
            const onRename = vi.fn();

            renderWithProviders(
                <>
                    <button type="button">Elsewhere</button>
                    {column({ onRename })}
                </>,
            );
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Rename' }),
            );
            await screen.findByRole('textbox', { name: 'Column title' });

            const input = screen.getByRole('textbox', { name: 'Column title' });
            const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

            fireEvent.change(input, { target: { value: 'Blurred' } });
            act(() => elsewhere.focus());

            expect(onRename).toHaveBeenCalledTimes(1);
            expect(onRename).toHaveBeenCalledWith('Blurred');
            expect(document.activeElement).toBe(elsewhere);
        });

        it('limits the title to the length the server accepts', async () => {
            renderWithProviders(column({ onRename: vi.fn() }));
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Rename' }),
            );
            await screen.findByRole('textbox', { name: 'Column title' });

            expect(screen.getByRole('textbox').getAttribute('maxlength')).toBe(
                '100',
            );
        });

        it('edits the description in a dialog limited to 200 characters', async () => {
            const onDescriptionChange = vi.fn();

            renderWithProviders(
                column({ onDescriptionChange, description: 'Old text' }),
            );
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', {
                    name: 'Edit description',
                }),
            );
            await screen.findByRole('dialog', { name: 'Column description' });

            const dialog = screen.getByRole('dialog', {
                name: 'Column description',
            });
            const field = within(dialog).getByRole('textbox', {
                name: 'Column description',
            }) as HTMLTextAreaElement;

            expect(field.value).toBe('Old text');
            expect(field.getAttribute('maxlength')).toBe('200');
            expect(within(dialog).getByText('8/200')).toBeTruthy();

            fireEvent.change(field, { target: { value: '  New guidance ' } });
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Save' }),
            );
            await dialogClosed();

            expect(onDescriptionChange).toHaveBeenCalledWith('New guidance');
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('clears the description when it is saved empty', async () => {
            const onDescriptionChange = vi.fn();

            renderWithProviders(
                column({ onDescriptionChange, description: 'Old text' }),
            );
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', {
                    name: 'Edit description',
                }),
            );
            await screen.findByRole('dialog', { name: 'Column description' });
            fireEvent.change(
                screen.getByRole('textbox', { name: 'Column description' }),
                { target: { value: '   ' } },
            );
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            await dialogClosed();

            expect(onDescriptionChange).toHaveBeenCalledWith(null);
        });

        it('moves the column left and right, within its bounds', async () => {
            const onMove = vi.fn();

            renderWithProviders(column({ onMove, canMoveLeft: false }));
            openMenu();

            expect(
                (
                    await screen.findByRole('menuitem', { name: 'Move left' })
                ).getAttribute('aria-disabled'),
            ).toBe('true');

            fireEvent.click(
                screen.getByRole('menuitem', { name: 'Move right' }),
            );

            expect(onMove).toHaveBeenCalledTimes(1);
            expect(onMove).toHaveBeenCalledWith(1);
        });

        it('deletes only after confirmation', async () => {
            const onDelete = vi.fn();

            renderWithProviders(column({ onDelete }));
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Delete column' }),
            );
            await screen.findByRole('alertdialog', { name: 'Delete column' });

            const dialog = screen.getByRole('alertdialog', {
                name: 'Delete column',
            });

            expect(onDelete).not.toHaveBeenCalled();
            expect(
                within(dialog).getByText('Delete the column What went well?'),
            ).toBeTruthy();

            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Delete' }),
            );
            await dialogClosed();

            expect(onDelete).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });

        it('keeps the column when the deletion is cancelled', async () => {
            const onDelete = vi.fn();

            renderWithProviders(column({ onDelete }));
            openMenu();
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Delete column' }),
            );
            await screen.findByRole('alertdialog', { name: 'Delete column' });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            await dialogClosed();

            expect(onDelete).not.toHaveBeenCalled();
            expect(screen.queryByRole('alertdialog')).toBeNull();
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Column menu' }),
            );
        });

        it('disables rename, colour and delete with the reason when the column has cards', async () => {
            const reason =
                'Only empty columns can be renamed, recoloured or deleted.';

            renderWithProviders(
                column({
                    onRename: vi.fn(),
                    onColorChange: vi.fn(),
                    onDescriptionChange: vi.fn(),
                    onMove: vi.fn(),
                    onDelete: vi.fn(),
                    editDisabledReason: reason,
                }),
            );
            openMenu();

            const disabled = async (name: string) =>
                (await screen.findByRole('menuitem', { name })).getAttribute(
                    'aria-disabled',
                );

            expect(await disabled('Rename')).toBe('true');
            expect(await disabled('Colour')).toBe('true');
            expect(await disabled('Delete column')).toBe('true');
            expect(await disabled('Edit description')).toBeNull();
            expect(await disabled('Move left')).toBeNull();
            expect(screen.getByText(reason)).toBeTruthy();
        });

        it('offers the eight colours under their names', async () => {
            const onColorChange = vi.fn();
            const { rerender } = renderWithProviders(
                column({ onColorChange, color: 'moss' }),
            );

            openMenu();
            fireEvent.keyDown(
                await screen.findByRole('menuitem', { name: 'Colour' }),
                { key: 'ArrowRight' },
            );

            expect(
                (await screen.findAllByRole('menuitemradio')).map(
                    (item) => item.textContent,
                ),
            ).toEqual([
                'Sun',
                'Apricot',
                'Coral',
                'Plum',
                'Iris',
                'Sky',
                'Lagoon',
                'Moss',
            ]);
            expect(
                screen
                    .getByRole('menuitemradio', { name: 'Moss' })
                    .getAttribute('aria-checked'),
            ).toBe('true');

            fireEvent.click(
                screen.getByRole('menuitemradio', { name: 'Coral' }),
            );
            expect(onColorChange).toHaveBeenCalledWith('coral');

            await menuClosed();
            rerender(column({ onColorChange, color: 'coral' }));
            openMenu();
            fireEvent.keyDown(
                await screen.findByRole('menuitem', { name: 'Colour' }),
                { key: 'ArrowRight' },
            );

            expect(
                (
                    await screen.findByRole('menuitemradio', { name: 'Coral' })
                ).getAttribute('aria-checked'),
            ).toBe('true');
            expect(
                screen
                    .getByRole('menuitemradio', { name: 'Moss' })
                    .getAttribute('aria-checked'),
            ).toBe('false');
        });

        it('does not add a card when N is typed inside the menu', async () => {
            const onAdd = vi.fn();

            renderWithProviders(column({ onAdd, onRename: vi.fn() }));
            openMenu();
            fireEvent.keyDown(
                await screen.findByRole('menuitem', { name: 'Rename' }),
                { key: 'n' },
            );

            expect(onAdd).not.toHaveBeenCalled();
        });
    });

    it('can start with its menu open for the bench', async () => {
        renderWithProviders(
            column({ onRename: vi.fn(), defaultMenuOpen: true }),
        );

        expect(
            await screen.findByRole('menuitem', { name: 'Rename' }),
        ).toBeTruthy();
    });

    it('takes its colour as the column context', () => {
        renderWithProviders(column({ color: 'sun' }));

        expect(screen.getByRole('region').classList.contains('col-sun')).toBe(
            true,
        );
    });

    it('renders the header action, notice and footer slots', () => {
        renderWithProviders(
            column({
                headerAction: <button type="button">New survey</button>,
                notice: <p>Drag cards onto each other to group them.</p>,
                footer: <form aria-label="Composer" />,
            }),
        );

        expect(screen.getByRole('button', { name: 'New survey' })).toBeTruthy();
        expect(
            screen.getByText('Drag cards onto each other to group them.'),
        ).toBeTruthy();
        expect(screen.getByRole('form', { name: 'Composer' })).toBeTruthy();
    });

    it('forwards the ref and rest props to the section', () => {
        const ref = createRef<HTMLElement>();
        const onKeyDown = vi.fn();

        renderWithProviders(
            column({
                ref,
                onKeyDown,
                'data-test': 'retro-column-col-1',
            } as Partial<RetroColumnProps>),
        );
        const section = screen.getByRole('region');

        fireEvent.keyDown(section, { key: 'x' });

        expect(ref.current).toBe(section);
        expect(section.getAttribute('data-test')).toBe('retro-column-col-1');
        expect(onKeyDown).toHaveBeenCalledTimes(1);
    });

    it('keeps 200 cards inside its own scroller', () => {
        const { container } = renderWithProviders(
            <RetroColumn id="big" title="Everything" color="sky" count={200}>
                {Array.from({ length: 200 }, (_, index) => (
                    <article key={index} data-slot="retro-card" tabIndex={0}>
                        {`Card ${index + 1}`}
                    </article>
                ))}
            </RetroColumn>,
        );
        const scroller = container.querySelector(
            '[data-slot="retro-column-cards"]',
        );

        expect(scroller?.querySelectorAll('article')).toHaveLength(200);
        expect(scroller?.classList.contains('overflow-y-auto')).toBe(true);
        expect(screen.getByText('200 cards')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Add a card' }).parentElement,
        ).toBe(screen.getByRole('region'));

        fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowUp' });

        expect(document.activeElement?.textContent).toBe('Card 200');
    });
});
