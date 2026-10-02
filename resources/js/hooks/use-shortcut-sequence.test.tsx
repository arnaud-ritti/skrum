import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcut } from '@/hooks/use-shortcut';
import {
    SequenceWindowMs,
    useShortcutSequence,
} from '@/hooks/use-shortcut-sequence';

function Harness({
    onSequence,
    onFirstKey = () => {},
}: {
    onSequence: () => void;
    onFirstKey?: () => void;
}) {
    useShortcutSequence(['g', 'a'], onSequence);
    useShortcut('g', onFirstKey);

    return <input aria-label="field" />;
}

describe('useShortcutSequence', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('calls the handler once for the two keys pressed within a second', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);

        fireEvent.keyDown(document.body, { key: 'g' });
        act(() => {
            vi.advanceTimersByTime(SequenceWindowMs);
        });
        fireEvent.keyDown(document.body, { key: 'a' });
        fireEvent.keyDown(document.body, { key: 'a' });

        expect(onSequence).toHaveBeenCalledTimes(1);
    });

    it('forgets the first key after more than a second', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);

        fireEvent.keyDown(document.body, { key: 'g' });
        act(() => {
            vi.advanceTimersByTime(SequenceWindowMs + 1);
        });
        fireEvent.keyDown(document.body, { key: 'a' });

        expect(onSequence).not.toHaveBeenCalled();
    });

    it('forgets the first key when another key comes between the two', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);

        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(document.body, { key: 'x' });
        fireEvent.keyDown(document.body, { key: 'a' });

        expect(onSequence).not.toHaveBeenCalled();
    });

    it('hears neither key in a field', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);
        const field = screen.getByLabelText('field');

        fireEvent.keyDown(field, { key: 'g' });
        fireEvent.keyDown(field, { key: 'a' });
        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(field, { key: 'a' });

        expect(onSequence).not.toHaveBeenCalled();
    });

    it('hears nothing while a dialog is open', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);
        const dialog = document.createElement('div');
        const button = document.createElement('button');
        dialog.setAttribute('role', 'dialog');
        dialog.append(button);
        document.body.append(dialog);

        fireEvent.keyDown(button, { key: 'g' });
        fireEvent.keyDown(button, { key: 'a' });

        expect(onSequence).not.toHaveBeenCalled();
        dialog.remove();
    });

    it('ignores a key pressed with Ctrl or Meta', () => {
        const onSequence = vi.fn();
        render(<Harness onSequence={onSequence} />);

        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });

        expect(onSequence).not.toHaveBeenCalled();
    });

    it('leaves the first key to a shortcut of the page', () => {
        const onSequence = vi.fn();
        const onFirstKey = vi.fn();
        render(<Harness onSequence={onSequence} onFirstKey={onFirstKey} />);

        fireEvent.keyDown(document.body, { key: 'g' });

        expect(onFirstKey).toHaveBeenCalledTimes(1);
    });
});
