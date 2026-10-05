import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Textarea } from './textarea';

function measure(
    textarea: HTMLTextAreaElement,
    box: { scrollHeight: number; clientHeight: number; offsetHeight: number },
): void {
    for (const [property, value] of Object.entries(box)) {
        Object.defineProperty(textarea, property, {
            configurable: true,
            value,
        });
    }
}

function ControlledTextarea() {
    const [value, setValue] = useState('');

    return (
        <Textarea
            aria-label="Note"
            value={value}
            onChange={(event) => setValue(event.target.value)}
        />
    );
}

describe('Textarea', () => {
    it('grows to its text once the text overflows its rows', () => {
        render(<Textarea aria-label="Note" defaultValue="" />);

        const textarea = screen.getByLabelText<HTMLTextAreaElement>('Note');

        measure(textarea, {
            scrollHeight: 120,
            clientHeight: 62,
            offsetHeight: 64,
        });
        fireEvent.input(textarea, { target: { value: 'A long text' } });

        expect(textarea.style.height).toBe('122px');
    });

    it('keeps the height of its rows while the text fits', () => {
        render(<Textarea aria-label="Note" defaultValue="" />);

        const textarea = screen.getByLabelText<HTMLTextAreaElement>('Note');

        textarea.style.height = '122px';
        measure(textarea, { scrollHeight: 62, clientHeight: 62, offsetHeight: 64 });
        fireEvent.input(textarea, { target: { value: 'Short' } });

        expect(textarea.style.height).toBe('');
    });

    it('grows when a controlled value changes', () => {
        render(<ControlledTextarea />);

        const textarea = screen.getByLabelText<HTMLTextAreaElement>('Note');

        measure(textarea, {
            scrollHeight: 200,
            clientHeight: 62,
            offsetHeight: 64,
        });
        fireEvent.change(textarea, { target: { value: 'A long text' } });

        expect(textarea.style.height).toBe('202px');
    });

    it('forwards its ref and calls the onInput of its caller', () => {
        const ref = createRef<HTMLTextAreaElement>();
        const onInput = vi.fn();

        render(<Textarea ref={ref} aria-label="Note" onInput={onInput} />);

        fireEvent.input(screen.getByLabelText('Note'), {
            target: { value: 'Hello' },
        });

        expect(ref.current).toBe(screen.getByLabelText('Note'));
        expect(onInput).toHaveBeenCalledOnce();
    });
});
