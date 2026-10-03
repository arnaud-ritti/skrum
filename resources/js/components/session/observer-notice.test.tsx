import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObserverNotice } from '@/components/session/observer-notice';
import { renderWithProviders } from '@/test/render';

describe('ObserverNotice', () => {
    it('tells an observer, politely, that they follow the session', () => {
        const { container } = renderWithProviders(<ObserverNotice />);
        const notice = screen.getByRole('status');

        expect(notice.textContent).toBe('You are observing this session.');
        expect(notice.getAttribute('data-slot')).toBe('observer-notice');
        expect(container.querySelector('svg[aria-hidden]')).not.toBeNull();
    });
});
