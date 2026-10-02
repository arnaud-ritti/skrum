import { fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from '@/hooks/use-swipe';

function Area({
    onSwipe,
    cancelOnDown = false,
}: {
    onSwipe: (direction: -1 | 1) => void;
    cancelOnDown?: boolean;
}) {
    const swipe = useSwipe(onSwipe);

    return (
        <div
            data-testid="area"
            {...swipe.handlers}
            onPointerMove={() => {
                if (cancelOnDown) {
                    swipe.cancel();
                }
            }}
        >
            <textarea aria-label="Editor" />
            {createPortal(<div data-testid="outside" />, document.body)}
        </div>
    );
}

function area(): HTMLElement {
    const node = screen.getByTestId('area');

    node.getBoundingClientRect = () =>
        ({ width: 400, height: 600, left: 0, top: 0 }) as DOMRect;

    return node;
}

function drag(node: HTMLElement, from: number, to: number, dy = 0): void {
    fireEvent.pointerDown(node, { clientX: from, clientY: 100, button: 0 });
    fireEvent.pointerMove(node, { clientX: to, clientY: 100 + dy });
    fireEvent.pointerUp(node, { clientX: to, clientY: 100 + dy });
}

describe('useSwipe', () => {
    it('goes to the next one past a quarter of the width to the left', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        drag(area(), 300, 190);

        expect(onSwipe).toHaveBeenCalledExactlyOnceWith(1);
    });

    it('goes to the previous one past a quarter of the width to the right', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        drag(area(), 100, 210);

        expect(onSwipe).toHaveBeenCalledExactlyOnceWith(-1);
    });

    it('does nothing under a quarter of the width', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        drag(area(), 300, 210);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('leaves a mostly vertical move to the scroll', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        drag(area(), 300, 180, 200);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores a move that a card drag took over', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} cancelOnDown />);
        drag(area(), 300, 100);

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores a move that starts in a text field', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        area();

        const editor = screen.getByLabelText('Editor');

        fireEvent.pointerDown(editor, { clientX: 300, clientY: 100 });
        fireEvent.pointerUp(editor, { clientX: 100, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores a move made in a dialog opened from the area', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);
        area();

        const outside = screen.getByTestId('outside');

        fireEvent.pointerDown(outside, { clientX: 300, clientY: 100 });
        fireEvent.pointerUp(outside, { clientX: 100, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('forgets a move the browser cancelled', () => {
        const onSwipe = vi.fn();

        render(<Area onSwipe={onSwipe} />);

        const node = area();

        fireEvent.pointerDown(node, { clientX: 300, clientY: 100 });
        fireEvent.pointerCancel(node);
        fireEvent.pointerUp(node, { clientX: 100, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });
});
