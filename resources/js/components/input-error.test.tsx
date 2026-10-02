import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InputError from '@/components/input-error';

describe('InputError', () => {
    it('renders nothing without a message', () => {
        const { container } = render(<InputError />);

        expect(container.innerHTML).toBe('');
    });

    it('shows the message in the destructive text token', () => {
        render(<InputError message="The name is required." />);

        const error = screen.getByText('The name is required.');

        expect(error.tagName).toBe('P');
        expect(error.className).toContain('text-skrum-destructive-text');
    });

    it('passes attributes and classes to the paragraph', () => {
        render(
            <InputError
                id="name-error"
                className="mt-2"
                message="The name is required."
            />,
        );

        const error = screen.getByText('The name is required.');

        expect(error.id).toBe('name-error');
        expect(error.className).toContain('mt-2');
    });
});
