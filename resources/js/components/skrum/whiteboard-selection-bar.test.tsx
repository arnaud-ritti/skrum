import { readFileSync } from 'node:fs';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    WhiteboardSelectionBar,
    WhiteboardSelectionCount,
} from '@/components/skrum/whiteboard-selection-bar';
import { renderWithProviders } from '@/test/render';

type BarProps = Parameters<typeof WhiteboardSelectionBar>[0];

function selectionBar(overrides: Partial<BarProps> = {}) {
    const props: BarProps = {
        colour: { value: 'apricot', onChange: vi.fn() },
        group: { kind: 'group', onPress: vi.fn() },
        align: { enabled: true, distribute: true, onCommand: vi.fn() },
        lock: { locked: false, onPress: vi.fn() },
        styles: { shown: false, onToggle: vi.fn() },
        remove: { onPress: vi.fn() },
        ...overrides,
    };

    renderWithProviders(<WhiteboardSelectionBar {...props} />);

    return props;
}

function toolbar(): HTMLElement {
    return screen.getByRole('toolbar', { name: 'Selection' });
}

function buttonNames(): string[] {
    return within(toolbar())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? '');
}

function openAlign(): void {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Align' }), {
        key: 'Enter',
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('WhiteboardSelectionBar', () => {
    it('shows the colours, a separator, then Group, Align, Lock, Styles and Delete in a horizontal toolbar', () => {
        selectionBar();

        expect(toolbar().getAttribute('aria-orientation')).toBe('horizontal');
        expect(
            within(toolbar()).getByRole('radiogroup', { name: 'Fill colour' }),
        ).toBeTruthy();
        expect(within(toolbar()).getAllByRole('radio')).toHaveLength(8);
        expect(
            within(toolbar())
                .getByRole('radio', { name: 'Apricot' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            toolbar().querySelectorAll(
                '[data-slot="whiteboard-toolbar-separator"]',
            ),
        ).toHaveLength(1);
        expect(buttonNames()).toEqual([
            'Group',
            'Align',
            'Lock',
            'Styles',
            'Delete',
        ]);
    });

    it('reports a colour press', () => {
        const props = selectionBar();

        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));

        expect(props.colour?.onChange).toHaveBeenCalledWith('moss');
    });

    it('has no colours and no separator when nothing selected has a fill', () => {
        selectionBar({ colour: undefined });

        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(
            toolbar().querySelectorAll(
                '[data-slot="whiteboard-toolbar-separator"]',
            ),
        ).toHaveLength(0);
        expect(buttonNames()[0]).toBe('Group');
    });

    it('disables the colours when asked', () => {
        selectionBar({
            colour: { value: 'sun', onChange: vi.fn(), disabled: true },
        });

        expect(
            (screen.getByRole('radio', { name: 'Sun' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('shows Ungroup for a group, and neither without a group command', () => {
        const props = selectionBar({
            group: { kind: 'ungroup', onPress: vi.fn() },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }));

        expect(props.group?.onPress).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', { name: 'Group' })).toBeNull();
    });

    it('hides Group and Ungroup when the selection has no group command', () => {
        selectionBar({ group: null });

        expect(buttonNames()).toEqual(['Align', 'Lock', 'Styles', 'Delete']);
    });

    it('calls Group on a press', () => {
        const props = selectionBar();

        fireEvent.click(screen.getByRole('button', { name: 'Group' }));

        expect(props.group?.onPress).toHaveBeenCalledOnce();
    });

    it('opens the six alignments and runs the chosen one', async () => {
        const props = selectionBar();

        openAlign();

        const items = await screen.findAllByRole('menuitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'Align left',
            'Align right',
            'Align top',
            'Align bottom',
            'Distribute horizontally',
            'Distribute vertically',
        ]);

        fireEvent.click(screen.getByRole('menuitem', { name: 'Align top' }));

        expect(props.align.onCommand).toHaveBeenCalledWith('alignTop');
    });

    it('disables the distributions for fewer than three elements', async () => {
        selectionBar({
            align: { enabled: true, distribute: false, onCommand: vi.fn() },
        });

        openAlign();

        expect(
            (
                await screen.findByRole('menuitem', {
                    name: 'Distribute horizontally',
                })
            ).getAttribute('aria-disabled'),
        ).toBe('true');
        expect(
            screen
                .getByRole('menuitem', { name: 'Distribute vertically' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
        expect(
            screen
                .getByRole('menuitem', { name: 'Align left' })
                .getAttribute('aria-disabled'),
        ).toBeNull();
    });

    it('disables Align when the selection cannot be aligned', () => {
        selectionBar({
            align: { enabled: false, distribute: false, onCommand: vi.fn() },
        });

        expect(
            (screen.getByRole('button', { name: 'Align' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('has no Lock without the lock command', () => {
        selectionBar({ lock: undefined });

        expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
    });

    it('keeps the Lock label and presses it on a locked selection, and calls it', () => {
        const props = selectionBar({
            lock: { locked: true, onPress: vi.fn() },
        });

        const unlock = screen.getByRole('button', { name: 'Lock' });

        expect(unlock.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(unlock);

        expect(props.lock?.onPress).toHaveBeenCalledOnce();
    });

    it('describes the toolbar with why Delete and the colours are disabled, once', () => {
        selectionBar({
            colour: {
                value: 'apricot',
                onChange: vi.fn(),
                disabled: true,
                reason: 'Only the facilitator can change a locked element.',
            },
            remove: {
                onPress: vi.fn(),
                disabled: true,
                reason: 'Only the facilitator can change a locked element.',
            },
        });

        expect(
            document.getElementById(
                toolbar().getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Only the facilitator can change a locked element.');
    });

    it('leaves the toolbar undescribed when nothing is disabled', () => {
        selectionBar();

        expect(toolbar().hasAttribute('aria-describedby')).toBe(false);
    });

    it('shows Lock not pressed on an unlocked selection', () => {
        selectionBar();

        expect(
            screen
                .getByRole('button', { name: 'Lock' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
    });

    it('shows the pressed state of Styles and toggles it', () => {
        const props = selectionBar({
            styles: { shown: true, onToggle: vi.fn() },
        });

        const styles = screen.getByRole('button', { name: 'Styles' });

        expect(styles.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(styles);

        expect(props.styles.onToggle).toHaveBeenCalledOnce();
    });

    it('deletes on a press, in the destructive colour', () => {
        const props = selectionBar();

        const remove = screen.getByRole('button', { name: 'Delete' });

        expect(remove.className).toContain('text-skrum-destructive-text');

        fireEvent.click(remove);

        expect(props.remove.onPress).toHaveBeenCalledOnce();
    });

    it('disables Delete with its reason as description', () => {
        const props = selectionBar({
            remove: {
                onPress: vi.fn(),
                disabled: true,
                reason: 'Only the facilitator can change a locked element.',
            },
        });

        const remove = screen.getByRole('button', {
            name: 'Delete',
        }) as HTMLButtonElement;

        expect(remove.disabled).toBe(true);
        expect(remove.getAttribute('aria-describedby')).toBeTruthy();
        expect(
            document.getElementById(
                remove.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Only the facilitator can change a locked element.');

        fireEvent.click(remove);

        expect(props.remove.onPress).not.toHaveBeenCalled();
    });

    it('moves the focus along its buttons with the arrows, wrapping and skipping disabled ones', () => {
        selectionBar({
            align: { enabled: false, distribute: false, onCommand: vi.fn() },
        });

        const group = screen.getByRole('button', { name: 'Group' });
        const lock = screen.getByRole('button', { name: 'Lock' });
        const remove = screen.getByRole('button', { name: 'Delete' });

        expect(group.tabIndex).toBe(0);
        expect(lock.tabIndex).toBe(-1);

        group.focus();
        fireEvent.keyDown(group, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(lock);

        fireEvent.keyDown(lock, { key: 'End' });
        expect(document.activeElement).toBe(remove);

        fireEvent.keyDown(remove, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(group);

        fireEvent.keyDown(group, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(remove);
        expect(remove.tabIndex).toBe(0);
        expect(group.tabIndex).toBe(-1);
    });

    it('takes the place it is given', () => {
        selectionBar({ style: { left: 150, top: 704 } });

        expect(toolbar().style.left).toBe('150px');
        expect(toolbar().style.top).toBe('704px');
    });

    it('reports its measured size once mounted and on resize', () => {
        let observed: ResizeObserverCallback | null = null;
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: ResizeObserverCallback) {
                    observed = callback;
                }

                observe(): void {}

                unobserve(): void {}

                disconnect(): void {}
            },
        );
        const box = vi
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockReturnValue({ width: 320, height: 44 } as DOMRect);
        const onSize = vi.fn();

        selectionBar({ onSize });

        expect(onSize).toHaveBeenLastCalledWith({ width: 320, height: 44 });

        box.mockReturnValue({ width: 280, height: 44 } as DOMRect);
        act(() => {
            observed?.([], {} as ResizeObserver);
        });

        expect(onSize).toHaveBeenLastCalledWith({ width: 280, height: 44 });
    });
});

describe('WhiteboardSelectionCount', () => {
    it('reads one element in the singular', () => {
        renderWithProviders(<WhiteboardSelectionCount count={1} />);

        expect(screen.getByText('1 element')).toBeTruthy();
    });

    it('reads several elements in the plural, at the place it is given', () => {
        renderWithProviders(
            <WhiteboardSelectionCount
                count={3}
                style={{ left: 100, top: 520 }}
            />,
        );

        const chip = screen.getByText('3 elements');

        expect(chip.style.left).toBe('100px');
        expect(chip.style.top).toBe('520px');
    });
});

describe('whiteboard selection bar', () => {
    it('only renders: no library, router or socket import', () => {
        const source = readFileSync(
            'resources/js/components/skrum/whiteboard-selection-bar.tsx',
            'utf8',
        );

        expect(source).not.toMatch(/from '@\/lib\/whiteboard\/excalidraw'/);
        expect(source).not.toMatch(/@excalidraw\//);
        expect(source).not.toMatch(/@inertiajs\/react/);
        expect(source).not.toMatch(/laravel-echo/);
    });
});
