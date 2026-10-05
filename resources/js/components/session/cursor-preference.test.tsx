import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    CursorToggle,
    HideMyCursorKey,
} from '@/components/session/cursor-preference';
import { renderWithProviders } from '@/test/render';

describe('CursorToggle', () => {
    it('keeps the storage key the old boards used', () => {
        expect(HideMyCursorKey).toBe('skrum.hideMyCursor');
    });

    it('is named "Hide my cursor", not pressed while shown, and reports the new value', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <CursorToggle hidden={false} onChange={onChange} />,
        );

        const button = screen.getByRole('button', { name: 'Hide my cursor' });

        expect(button.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(button);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('keeps its name and is pressed while the cursor is hidden', () => {
        renderWithProviders(<CursorToggle hidden onChange={() => {}} />);

        expect(
            screen
                .getByRole('button', { name: 'Hide my cursor' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
    });
});
