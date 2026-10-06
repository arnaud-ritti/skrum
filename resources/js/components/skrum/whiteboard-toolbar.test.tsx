import { readFileSync } from 'node:fs';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hand, Image, MousePointer2, StickyNote, Undo2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import {
    WhiteboardColorBar,
    WhiteboardSubBar,
    WhiteboardToolbar,
} from '@/components/skrum/whiteboard-toolbar';
import type { ToolbarItem } from '@/components/skrum/whiteboard-toolbar';
import { renderWithProviders } from '@/test/render';

describe('WhiteboardColorBar', () => {
    it('shows the eight colours with only the current one checked', () => {
        renderWithProviders(
            <WhiteboardColorBar value="sky" onChange={vi.fn()} />,
        );

        expect(screen.getAllByRole('radio')).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sky' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: 'Sun' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('draws the ring of the chosen colour on the swatch itself, a round square, with no element of its own that could drift', () => {
        renderWithProviders(
            <WhiteboardColorBar value="sky" onChange={vi.fn()} />,
        );

        const chosen = screen.getByRole('radio', { name: 'Sky' });
        const other = screen.getByRole('radio', { name: 'Sun' });
        const swatch = chosen.firstElementChild as HTMLElement;

        expect(chosen.children).toHaveLength(1);
        expect(swatch.className).toContain('size-5');
        expect(swatch.className).toContain('rounded-full');
        expect(swatch.className).toContain('ring-2');
        expect(swatch.className).toContain('ring-offset-2');
        expect(swatch.className).toContain('ring-offset-popover');
        expect(swatch.querySelector('*')).toBeNull();
        expect(other.children).toHaveLength(1);
        expect(other.firstElementChild?.className).not.toContain('ring-');
    });

    it('reports the clicked colour', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="sun" onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));

        expect(onChange).toHaveBeenCalledWith('moss');
    });

    it('moves with the arrow keys and wraps around', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="moss" onChange={onChange} />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Moss' }), {
            key: 'ArrowRight',
        });
        expect(onChange).toHaveBeenLastCalledWith('sun');

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Moss' }), {
            key: 'ArrowLeft',
        });
        expect(onChange).toHaveBeenLastCalledWith('lagoon');
    });

    it('moves from the focused colour, even while the value has not followed yet', () => {
        renderWithProviders(
            <WhiteboardColorBar value="apricot" onChange={vi.fn()} />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Apricot' }), {
            key: 'ArrowRight',
        });
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Coral' }),
        );

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Plum' }),
        );
    });

    it('keeps only the checked colour in the tab order', () => {
        renderWithProviders(
            <WhiteboardColorBar value="iris" onChange={vi.fn()} />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Iris' })
                .getAttribute('tabindex'),
        ).toBe('0');
        expect(
            screen
                .getByRole('radio', { name: 'Plum' })
                .getAttribute('tabindex'),
        ).toBe('-1');
    });

    it('does not report anything when disabled', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="sun" onChange={onChange} disabled />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Coral' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('exposes its orientation', () => {
        renderWithProviders(
            <WhiteboardColorBar
                value="sun"
                onChange={vi.fn()}
                orientation="vertical"
            />,
        );

        expect(
            screen.getByRole('radiogroup').getAttribute('aria-orientation'),
        ).toBe('vertical');
    });

    it('checks no colour and keeps the first one reachable when the fill is not one of the eight', () => {
        renderWithProviders(
            <WhiteboardColorBar value={null} onChange={vi.fn()} />,
        );

        expect(
            screen
                .getAllByRole('radio')
                .filter(
                    (radio) => radio.getAttribute('aria-checked') === 'true',
                ),
        ).toHaveLength(0);
        expect(
            screen.getByRole('radio', { name: 'Sun' }).getAttribute('tabindex'),
        ).toBe('0');
        expect(
            screen
                .getByRole('radio', { name: 'Apricot' })
                .getAttribute('tabindex'),
        ).toBe('-1');
    });

    it('starts from the first colour with the arrow keys when none is checked', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value={null} onChange={onChange} />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(onChange).toHaveBeenLastCalledWith('apricot');
    });

    it('reports a press apart from a move of the selection', () => {
        const onChange = vi.fn();
        const onActivate = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar
                value="sun"
                onChange={onChange}
                onActivate={onActivate}
            />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(onChange).toHaveBeenLastCalledWith('apricot');
        expect(onActivate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        expect(onChange).toHaveBeenLastCalledWith('sky');
        expect(onActivate).toHaveBeenCalledWith('sky');
    });
});

function tools(overrides: Partial<Record<string, Partial<ToolbarItem>>> = {}) {
    const item = (
        id: string,
        label: string,
        icon: ToolbarItem['icon'],
        extra: Partial<ToolbarItem> = {},
    ): ToolbarItem => ({
        id,
        label,
        icon,
        onPress: vi.fn(),
        ...extra,
        ...overrides[id],
    });

    return [
        [
            item('selection', 'Selection', MousePointer2, {
                shortcut: 'V',
                pressed: false,
            }),
            item('hand', 'Hand', Hand, { shortcut: 'H', pressed: false }),
        ],
        [
            item('sticky', 'Sticky note', StickyNote, {
                shortcut: 'N',
                pressed: false,
            }),
            item('image', 'Image', Image, { pressed: false }),
        ],
        [item('undo', 'Undo', Undo2)],
    ] as const;
}

function toolButton(name: string): HTMLElement {
    return screen.getByRole('button', { name });
}

describe('WhiteboardToolbar', () => {
    it('renders one named toolbar with the items in order and a separator between groups', () => {
        const { container } = renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                groups={tools()}
                orientation="vertical"
            />,
        );

        const toolbar = screen.getByRole('toolbar', { name: 'Tools' });

        expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
        expect(
            screen
                .getAllByRole('button')
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Selection', 'Hand', 'Sticky note', 'Image', 'Undo']);
        expect(
            container.querySelectorAll(
                '[data-slot="whiteboard-toolbar-separator"]',
            ),
        ).toHaveLength(2);
    });

    it('marks the pressed item and leaves aria-pressed off a plain button', () => {
        renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                groups={tools({ sticky: { pressed: true } })}
            />,
        );

        expect(toolButton('Sticky note').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(toolButton('Hand').getAttribute('aria-pressed')).toBe('false');
        expect(toolButton('Undo').hasAttribute('aria-pressed')).toBe(false);
    });

    it('exposes the key and shows its letter in the corner, hidden from assistive technology', () => {
        renderWithProviders(
            <WhiteboardToolbar label="Tools" groups={tools()} />,
        );

        const sticky = toolButton('Sticky note');
        const letter = sticky.querySelector(
            '[data-slot="whiteboard-tool-key"]',
        );

        expect(sticky.getAttribute('aria-keyshortcuts')).toBe('N');
        expect(letter?.textContent).toBe('N');
        expect(letter?.getAttribute('aria-hidden')).toBe('true');
        expect(toolButton('Image').hasAttribute('aria-keyshortcuts')).toBe(
            false,
        );
    });

    it('keeps one tab stop on the first enabled item, or on the pressed one', () => {
        const { unmount } = renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                groups={tools({ selection: { disabled: true } })}
            />,
        );

        expect(toolButton('Hand').tabIndex).toBe(0);
        expect(toolButton('Selection').tabIndex).toBe(-1);
        expect(toolButton('Sticky note').tabIndex).toBe(-1);

        unmount();
        renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                groups={tools({ sticky: { pressed: true } })}
            />,
        );

        expect(toolButton('Sticky note').tabIndex).toBe(0);
        expect(toolButton('Selection').tabIndex).toBe(-1);
    });

    it('moves the focus with the arrows of its orientation, wrapping, with Home and End, skipping disabled items', () => {
        renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                orientation="vertical"
                groups={tools({ hand: { disabled: true } })}
                trailing={
                    <button type="button" data-roving-item="">
                        More tools
                    </button>
                }
            />,
        );

        toolButton('Selection').focus();
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });
        expect(document.activeElement).toBe(toolButton('Sticky note'));
        expect(toolButton('Sticky note').tabIndex).toBe(0);
        expect(toolButton('Selection').tabIndex).toBe(-1);

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(document.activeElement).toBe(toolButton('Sticky note'));

        fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
        expect(document.activeElement).toBe(toolButton('More tools'));
        expect(toolButton('More tools').tabIndex).toBe(0);

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });
        expect(document.activeElement).toBe(toolButton('Selection'));

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowUp',
        });
        expect(document.activeElement).toBe(toolButton('More tools'));

        fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
        expect(document.activeElement).toBe(toolButton('Selection'));
        expect(toolButton('More tools').tabIndex).toBe(-1);
    });

    it('keeps a single tab stop among several trailing items, and falls back to the items when the focused one goes', () => {
        const toolbar = (trailing: boolean) => (
            <WhiteboardToolbar
                label="Tools"
                groups={tools()}
                trailing={
                    trailing && (
                        <>
                            <button type="button" data-roving-item="">
                                More tools
                            </button>
                            <button type="button" data-roving-item="">
                                Help
                            </button>
                        </>
                    )
                }
            />
        );
        const { rerender } = renderWithProviders(toolbar(true));

        act(() => toolButton('Help').focus());

        expect(toolButton('Help').tabIndex).toBe(0);
        expect(toolButton('More tools').tabIndex).toBe(-1);
        expect(toolButton('Selection').tabIndex).toBe(-1);

        rerender(toolbar(false));

        expect(toolButton('Selection').tabIndex).toBe(0);
    });

    it('moves with left and right in a horizontal bar', () => {
        renderWithProviders(
            <WhiteboardToolbar
                label="Tools"
                orientation="horizontal"
                groups={tools()}
            />,
        );

        toolButton('Selection').focus();
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(document.activeElement).toBe(toolButton('Hand'));

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });
        expect(document.activeElement).toBe(toolButton('Hand'));

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });
        expect(document.activeElement).toBe(toolButton('Undo'));
    });

    it('presses an item with Enter, Space or a click, and a disabled one not at all', async () => {
        const user = userEvent.setup();
        const groups = tools({ hand: { disabled: true } });
        renderWithProviders(
            <WhiteboardToolbar label="Tools" groups={groups} />,
        );

        const selection = groups[0][0];
        const hand = groups[0][1];

        toolButton('Selection').focus();
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        await user.click(toolButton('Selection'));
        await user.click(toolButton('Hand'));

        expect(selection.onPress).toHaveBeenCalledTimes(3);
        expect(hand.onPress).not.toHaveBeenCalled();
    });

    it('shows the label and the key in a tooltip on hover or focus', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WhiteboardToolbar label="Tools" groups={tools()} />,
        );

        await user.hover(toolButton('Sticky note'));

        const tooltip = await screen.findByRole('tooltip');
        expect(tooltip.textContent).toContain('Sticky note');
        expect(tooltip.textContent).toContain('N');

        await user.unhover(toolButton('Sticky note'));
        await user.tab();

        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'Selection',
        );
    });
});

describe('WhiteboardSubBar', () => {
    it('renders a named toolbar around its children', () => {
        renderWithProviders(
            <WhiteboardSubBar label="Sticky note colours">
                <WhiteboardColorBar value="sun" onChange={vi.fn()} />
            </WhiteboardSubBar>,
        );

        const subBar = screen.getByRole('toolbar', {
            name: 'Sticky note colours',
        });

        expect(subBar.querySelector('[role="radiogroup"]')).not.toBeNull();
    });
});

describe('whiteboard-toolbar.tsx', () => {
    it('stays presentational: no library, router or Echo import', () => {
        const source = readFileSync(
            'resources/js/components/skrum/whiteboard-toolbar.tsx',
            'utf8',
        );

        expect(source).not.toMatch(/from '@\/lib\/whiteboard\/excalidraw'/);
        expect(source).not.toMatch(/@excalidraw\//);
        expect(source).not.toMatch(/@inertiajs\/react/);
        expect(source).not.toMatch(/laravel-echo/);
    });
});
