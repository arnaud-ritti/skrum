import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GifCaptionField } from './gif-caption-field';

describe('GifCaptionField', () => {
    it('is a labelled field of 60 characters with its counter', () => {
        render(
            <GifCaptionField value="CI on Friday at 6 pm" onChange={vi.fn()} />,
        );

        const field = screen.getByLabelText('Caption');

        expect(field.getAttribute('maxlength')).toBe('60');
        expect(screen.getByText('20 / 60')).toBeTruthy();
        expect(field.getAttribute('aria-describedby')).toBe(
            screen.getByText('20 / 60').id,
        );
    });

    it('never passes on more than 60 characters', () => {
        const onChange = vi.fn();

        render(<GifCaptionField value="" onChange={onChange} />);
        fireEvent.change(screen.getByLabelText('Caption'), {
            target: { value: 'x'.repeat(70) },
        });

        expect(onChange).toHaveBeenCalledWith('x'.repeat(60));
    });
});
