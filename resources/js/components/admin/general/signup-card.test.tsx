import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SignupCard } from './signup-card';

function setup(overrides: Partial<Parameters<typeof SignupCard>[0]> = {}): {
    onModeChange: ReturnType<typeof vi.fn>;
    onDomainsChange: ReturnType<typeof vi.fn>;
} {
    const onModeChange = vi.fn();
    const onDomainsChange = vi.fn();

    renderWithProviders(
        <SignupCard
            mode="domain"
            domains={['acme.fr']}
            defaults={{ signupMode: 'invite', allowedEmailDomains: [] }}
            onModeChange={onModeChange}
            onDomainsChange={onDomainsChange}
            {...overrides}
        />,
    );

    return { onModeChange, onDomainsChange };
}

describe('SignupCard', () => {
    it('says the mode of the environment', () => {
        setup();

        expect(
            screen.getByText('Default from the environment: Invitation only'),
        ).not.toBeNull();
    });

    it('adds a typed domain on Enter, lower-cased and once', () => {
        const { onDomainsChange } = setup();
        const input = screen.getByLabelText('E-mail domains');

        fireEvent.change(input, { target: { value: ' Example.ORG ' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onDomainsChange).toHaveBeenCalledExactlyOnceWith([
            'acme.fr',
            'example.org',
        ]);

        fireEvent.change(input, { target: { value: 'acme.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onDomainsChange).toHaveBeenCalledOnce();
    });

    it('refuses something that is not a domain, under the field', () => {
        const { onDomainsChange } = setup();
        const input = screen.getByLabelText('E-mail domains');

        fireEvent.change(input, { target: { value: 'not a domain' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onDomainsChange).not.toHaveBeenCalled();
        expect(
            screen.getByText('Enter a domain such as example.com.'),
        ).not.toBeNull();
        expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('removes a domain with its button', () => {
        const { onDomainsChange } = setup({ domains: ['acme.fr', 'b.io'] });

        fireEvent.click(screen.getByRole('button', { name: 'Remove acme.fr' }));

        expect(onDomainsChange).toHaveBeenCalledExactlyOnceWith(['b.io']);
    });

    it('shows the server error of a domain', () => {
        setup({ error: 'The domain is not valid.' });

        expect(screen.getByText('The domain is not valid.')).not.toBeNull();
    });
});
