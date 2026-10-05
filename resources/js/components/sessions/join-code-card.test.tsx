import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JoinCodeCard } from '@/components/sessions/join-code-card';
import { normaliseJoinCode } from '@/lib/sessions/join-code';
import { renderWithProviders } from '@/test/render';

function renderCard(props: Partial<Parameters<typeof JoinCodeCard>[0]> = {}) {
    const onSubmit = vi.fn();

    renderWithProviders(
        <JoinCodeCard onSubmit={onSubmit} loginUrl="/login" {...props} />,
    );

    return {
        onSubmit,
        field: screen.getByLabelText('Session code') as HTMLInputElement,
    };
}

describe('JoinCodeCard', () => {
    it('asks for the code the facilitator shared', () => {
        const { field } = renderCard();

        expect(
            screen.getByRole('heading', { name: 'Join a session' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Type the code the facilitator shared.'),
        ).toBeTruthy();
        expect(field.placeholder).toBe('K7Q-P4M2');
        expect(normaliseJoinCode(field.placeholder)).toBe('K7Q-P4M2');
        expect(field.getAttribute('autocomplete')).toBe('off');
        expect(document.activeElement).toBe(field);
        expect(
            screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'),
        ).toBe('/login');
    });

    it('formats the code while it is typed', () => {
        const { field } = renderCard();

        fireEvent.change(field, { target: { value: 'k7qp' } });

        expect(field.value).toBe('K7Q-P');
    });

    it('says a short code is not a code, without sending it', () => {
        const { field, onSubmit } = renderCard();

        fireEvent.change(field, { target: { value: 'k7qp4' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText('The code has 8 characters')).toBeTruthy();
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(field.getAttribute('aria-describedby')).toBeTruthy();

        fireEvent.change(field, { target: { value: 'k7qp4m' } });

        expect(screen.queryByText('The code has 8 characters')).toBeNull();
    });

    it('sends a valid code in its written form', () => {
        const { field, onSubmit } = renderCard();

        fireEvent.change(field, { target: { value: 'k7q p4m2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(onSubmit).toHaveBeenCalledWith('K7Q-P4M2');
    });

    it('leaves a full-length code with a look-alike to the server', () => {
        const { field, onSubmit } = renderCard();

        fireEvent.change(field, { target: { value: 'k0qp4m2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(onSubmit).toHaveBeenCalledWith('K0Q-P4M2');
        expect(screen.queryByText('The code has 8 characters')).toBeNull();
    });

    it('shows the server answer on the field until the code changes', () => {
        const { field } = renderCard({
            error: 'No session matches this code.',
        });

        expect(screen.getByText('No session matches this code.')).toBeTruthy();
        expect(field.getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(field, { target: { value: 'A' } });

        expect(screen.queryByText('No session matches this code.')).toBeNull();
    });

    it('shows the same server answer again after a second wrong code', () => {
        const onSubmit = vi.fn();
        const error = 'No session matches this code.';
        const { rerender } = renderWithProviders(
            <JoinCodeCard
                onSubmit={onSubmit}
                loginUrl="/login"
                error={error}
            />,
        );
        const field = screen.getByLabelText('Session code') as HTMLInputElement;

        fireEvent.change(field, { target: { value: 'k7qp4m2x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        rerender(
            <JoinCodeCard
                onSubmit={onSubmit}
                loginUrl="/login"
                error={error}
                processing
            />,
        );
        rerender(
            <JoinCodeCard
                onSubmit={onSubmit}
                loginUrl="/login"
                error={error}
            />,
        );

        expect(onSubmit).toHaveBeenCalledWith('K7Q-P4M2');
        expect(screen.getByText(error)).toBeTruthy();
        expect(field.getAttribute('aria-invalid')).toBe('true');
    });

    it('docks the button at the bottom on a phone', () => {
        renderCard({ stickyAction: true });

        expect(
            document
                .querySelector('[data-slot="join-code-action"]')
                ?.className.includes('sticky'),
        ).toBe(true);
    });
});
