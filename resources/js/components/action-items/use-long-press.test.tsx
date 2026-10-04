import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongPress } from '@/components/action-items/use-long-press';

function Item({
    onLongPress,
    onClick,
}: {
    onLongPress: () => void;
    onClick: () => void;
}) {
    const press = useLongPress(onLongPress);

    return (
        <div data-testid="item" {...press}>
            <button type="button" onClick={onClick}>
                Open
            </button>
        </div>
    );
}

function setup() {
    const onLongPress = vi.fn();
    const onClick = vi.fn();

    render(<Item onLongPress={onLongPress} onClick={onClick} />);

    return { onLongPress, onClick, button: screen.getByRole('button') };
}

describe('useLongPress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fires after 500 ms held still and swallows the tap that ends it', () => {
        const { onLongPress, onClick, button } = setup();

        fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
        vi.advanceTimersByTime(500);
        fireEvent.pointerUp(button, { clientX: 10, clientY: 10 });
        fireEvent.click(button);

        expect(onLongPress).toHaveBeenCalledOnce();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('leaves a 200 ms press to the tap', () => {
        const { onLongPress, onClick, button } = setup();

        fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
        vi.advanceTimersByTime(200);
        fireEvent.pointerUp(button, { clientX: 10, clientY: 10 });
        fireEvent.click(button);
        vi.advanceTimersByTime(500);

        expect(onLongPress).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('is cancelled by a move beyond 10 px', () => {
        const { onLongPress, button } = setup();

        fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
        fireEvent.pointerMove(button, { clientX: 10, clientY: 25 });
        vi.advanceTimersByTime(500);

        expect(onLongPress).not.toHaveBeenCalled();
    });

    it('tolerates a small move', () => {
        const { onLongPress, button } = setup();

        fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
        fireEvent.pointerMove(button, { clientX: 15, clientY: 14 });
        vi.advanceTimersByTime(500);

        expect(onLongPress).toHaveBeenCalledOnce();
    });

    it('prevents the context menu of a long press', () => {
        const { button } = setup();

        fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
        vi.advanceTimersByTime(500);

        expect(fireEvent.contextMenu(button)).toBe(false);
    });

    it('ignores a mouse', () => {
        const { onLongPress, button } = setup();
        const down = new MouseEvent('pointerdown', { bubbles: true });

        Object.defineProperty(down, 'pointerType', { value: 'mouse' });
        fireEvent(button, down);
        vi.advanceTimersByTime(500);

        expect(onLongPress).not.toHaveBeenCalled();
    });
});
