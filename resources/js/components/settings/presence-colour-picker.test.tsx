import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PresenceColourPicker } from './presence-colour-picker';

describe('PresenceColourPicker', () => {
    it('shows the title, the sentence and the current colour', () => {
        renderWithProviders(
            <PresenceColourPicker value={6} onChange={() => {}} />,
        );

        expect(screen.getByText('Avatar & presence colour')).toBeTruthy();
        expect(
            screen.getByText('Used for your avatar and your live cursor.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('radiogroup', {
                name: 'Avatar & presence colour',
            }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: 'Colour 6' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('sends the colour with the form as presence_color', () => {
        const { container } = renderWithProviders(
            <form>
                <PresenceColourPicker value={6} onChange={() => {}} />
            </form>,
        );

        const form = container.querySelector('form') as HTMLFormElement;

        expect(new FormData(form).get('presence_color')).toBe('6');
    });

    it('reports the chosen colour', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <PresenceColourPicker value={6} onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Colour 11' }));

        expect(onChange).toHaveBeenCalledWith(11);
    });
});
