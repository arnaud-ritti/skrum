import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { groupSetupKey, TwoFactorSetup } from './two-factor-setup';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

const setup = {
    qrCodeSvg: '<svg data-test="qr"></svg>',
    manualSetupKey: 'JBSWY3DPEHPK3PXP',
    requiresConfirmation: true,
    code: '',
    onCodeChange: () => undefined,
    processing: false,
};

beforeEach(() => {
    page.props = { translations: {} };
});

describe('groupSetupKey', () => {
    it('writes the key in groups of four', () => {
        expect(groupSetupKey('JBSWY3DPEHPK3PXP4L')).toBe(
            'JBSW Y3DP EHPK 3PXP 4L',
        );
    });
});

describe('TwoFactorSetup', () => {
    it('draws the QR code dark on light in any theme, with a name', () => {
        renderWithProviders(<TwoFactorSetup {...setup} />);

        const qr = screen.getByRole('img', {
            name: 'QR code for your authenticator app',
        });

        expect(qr.classList.contains('light')).toBe(true);
        expect(qr.querySelector('svg[data-test="qr"]')).not.toBeNull();
        expect(qr.querySelector('[style*="filter"]')).toBeNull();
    });

    it('puts the logo in the middle of the QR code', () => {
        renderWithProviders(<TwoFactorSetup {...setup} />);

        const logo = document.querySelector('[data-slot="two-factor-qr-logo"]');

        expect(logo).not.toBeNull();
        expect(logo!.querySelector('[data-part="symbol"]')).not.toBeNull();
        expect(logo!.closest('[data-slot="two-factor-qr"]')).not.toBeNull();
    });

    it('shows the manual key in groups of four and copies it whole', async () => {
        const user = userEvent.setup();
        const writeText = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue();

        renderWithProviders(<TwoFactorSetup {...setup} />);

        expect(
            document.querySelector('[data-slot="two-factor-key"]')?.textContent,
        ).toContain('JBSW Y3DP EHPK 3PXP');

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
        expect(
            await screen.findByRole('button', { name: 'Copied' }),
        ).toBeTruthy();
    });

    it('asks for the code in one field of six digits, in the card', () => {
        renderWithProviders(<TwoFactorSetup {...setup} />);

        const code = screen.getByLabelText('Enter the 6-digit code');

        expect(code.getAttribute('name')).toBe('code');
        expect(code.getAttribute('maxlength')).toBe('6');
        expect(code.getAttribute('autocomplete')).toBe('one-time-code');
        expect(
            document.querySelectorAll('[data-slot="input-otp-slot"]').length,
        ).toBe(6);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            screen.getByText('The code changes every 30 seconds.'),
        ).toBeTruthy();
    });

    it('shows a refused code under the boxes', () => {
        renderWithProviders(
            <TwoFactorSetup
                {...setup}
                codeError="The provided two factor authentication code was invalid."
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The provided two factor authentication code was invalid.',
        );
    });

    it('has no code step when the server does not ask for a confirmation', () => {
        renderWithProviders(
            <TwoFactorSetup {...setup} requiresConfirmation={false} />,
        );

        expect(screen.queryByLabelText('Enter the 6-digit code')).toBeNull();
        expect(screen.getByText('Scan the QR code')).toBeTruthy();
    });

    it('holds the places of the QR code and of the key while they are fetched', () => {
        renderWithProviders(
            <TwoFactorSetup
                {...setup}
                qrCodeSvg={null}
                manualSetupKey={null}
            />,
        );

        expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(
            2,
        );
        expect(
            screen
                .getByRole('button', { name: 'Copy' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });
});
