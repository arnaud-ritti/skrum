import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { BrandingPageProps } from './branding';
import {
    BrandingVisitError,
    fetchPalettePreview,
    removeAsset,
    resetBranding,
    uploadAsset,
} from './branding-api';
import { BrandingForm } from './branding-form';
import { adjustedPalette, sampleProps } from './samples';

vi.mock('./branding-api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./branding-api')>()),
    fetchPalettePreview: vi.fn(),
    uploadAsset: vi.fn(),
    removeAsset: vi.fn(),
    resetBranding: vi.fn(),
}));

function setup(overrides: Partial<BrandingPageProps> = {}) {
    return renderWithProviders(
        <BrandingForm {...sampleProps(overrides)} adminName="Ada Admin" />,
    );
}

function status(): string {
    return screen.getByRole('status').textContent ?? '';
}

function saveButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
}

function stage(container: HTMLElement): HTMLElement {
    return container.querySelector(
        '[data-slot=brand-preview-stage]',
    ) as HTMLElement;
}

beforeEach(() => {
    vi.mocked(fetchPalettePreview).mockReset();
    vi.mocked(uploadAsset).mockReset().mockResolvedValue(undefined);
    vi.mocked(removeAsset).mockReset().mockResolvedValue(undefined);
    vi.mocked(resetBranding).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('BrandingForm unsaved changes', () => {
    it('starts clean with Save and Cancel disabled', () => {
        setup();

        expect(status()).toBe('No unsaved changes');
        expect(saveButton().disabled).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Cancel',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('counts each changed field once and returns to zero on Cancel', () => {
        setup();

        const name = screen.getByLabelText('Display name') as HTMLInputElement;

        fireEvent.change(name, { target: { value: 'Nordlys' } });

        expect(status()).toBe('1 unsaved change');

        fireEvent.change(name, { target: { value: 'Nordlys Retro' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Round 16' }));
        fireEvent.click(
            screen.getByRole('switch', { name: 'Show "Powered by Skrüm"' }),
        );

        expect(status()).toBe('3 unsaved changes');
        expect(saveButton().disabled).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(name.value).toBe('');
        expect(
            screen
                .getByRole('radio', { name: 'Standard 10' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('does not count a value typed back to what is stored', () => {
        setup();

        const color = screen.getByLabelText('Primary colour');

        fireEvent.change(color, { target: { value: '#ffd600' } });

        expect(status()).toBe('1 unsaved change');

        fireEvent.change(color, { target: { value: ' 2B63B0 ' } });

        expect(status()).toBe('No unsaved changes');
    });
});

describe('BrandingForm GIF key', () => {
    it('never renders a stored key and counts a removal as a change', () => {
        const { container } = setup({ hasGifKey: true, gifProvider: 'giphy' });

        expect(container.querySelector('input[type=password]')).toBeNull();
        expect(screen.getByText('A key is set')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

        expect(status()).toBe('1 unsaved change');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(screen.getByText('A key is set')).toBeTruthy();
    });

    it('drops a typed key on Cancel', () => {
        const { container } = setup({ hasGifKey: true });

        fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
        fireEvent.change(
            container.querySelector('input[type=password]') as HTMLInputElement,
            { target: { value: 'typed-key' } },
        );

        expect(status()).toBe('1 unsaved change');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(container.querySelector('input[type=password]')).toBeNull();
        expect(container.innerHTML).not.toContain('typed-key');
    });
});

describe('BrandingForm images', () => {
    function fileInputs(container: HTMLElement): HTMLInputElement[] {
        return Array.from(container.querySelectorAll('input[type=file]'));
    }

    it('uploads a valid file for the right asset without touching the form', () => {
        const { container } = setup();
        const file = new File(['x'], 'logo.png', { type: 'image/png' });

        fireEvent.change(fileInputs(container)[1], {
            target: { files: [file] },
        });

        expect(uploadAsset).toHaveBeenCalledExactlyOnceWith('logo-dark', file);
        expect(status()).toBe('No unsaved changes');
    });

    it('offers a logo for e-mails with its own format line', () => {
        const { container } = setup();
        const file = new File(['x'], 'logo.png', { type: 'image/png' });

        fireEvent.change(fileInputs(container)[3], {
            target: { files: [file] },
        });

        expect(uploadAsset).toHaveBeenCalledExactlyOnceWith('logo-mail', file);
        expect(
            screen.getByText(
                'PNG or JPEG, at least 128 px wide. Mail clients do not draw SVG.',
            ),
        ).toBeTruthy();
        expect(container.querySelector('[data-slot=asset-warning]')).toBeNull();
    });

    it('warns that e-mails show the name while the instance logo cannot be drawn in a mail', () => {
        const { container } = setup({
            assets: {
                logoLightUrl: '/brand/logo-light?v=1',
                logoDarkUrl: null,
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: true,
            },
        });

        expect(
            container.querySelector('[data-slot=asset-warning]')?.textContent,
        ).toBe(
            'E-mails show the name as text until a PNG or JPEG logo is added.',
        );
    });

    it('uploads nothing for a 600 KB file or a GIF', () => {
        const { container } = setup();
        const [light] = fileInputs(container);

        fireEvent.change(light, {
            target: {
                files: [
                    new File([new Uint8Array(600 * 1024)], 'logo.png', {
                        type: 'image/png',
                    }),
                ],
            },
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'This file is larger than 512 KB.',
        );

        fireEvent.change(light, {
            target: {
                files: [new File(['x'], 'logo.gif', { type: 'image/gif' })],
            },
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'Use a PNG, JPEG, WebP or SVG image.',
        );
        expect(uploadAsset).not.toHaveBeenCalled();
    });

    it('shows the server refusal under the card', async () => {
        vi.mocked(uploadAsset).mockRejectedValueOnce(
            new BrandingVisitError({ file: 'The image is not valid.' }),
        );

        const { container } = setup();

        fireEvent.change(fileInputs(container)[2], {
            target: {
                files: [new File(['x'], 'icon.png', { type: 'image/png' })],
            },
        });

        const alert = await screen.findByRole('alert');

        expect(alert.textContent).toBe('The image is not valid.');
        expect(
            alert.closest('[data-slot=asset-uploader]')?.textContent,
        ).toContain('Favicon');
    });
});

describe('BrandingForm preview', () => {
    it('paints the stage with the stored palette, then with the typed colour', async () => {
        vi.useFakeTimers();
        vi.mocked(fetchPalettePreview).mockResolvedValue(adjustedPalette);

        const { container } = setup();

        expect(stage(container).style.getPropertyValue('--primary')).toBe(
            '#2b63b0',
        );
        expect(stage(container).style.getPropertyValue('--radius')).toBe(
            '0.625rem',
        );

        fireEvent.change(screen.getByLabelText('Primary colour'), {
            target: { value: 'FFD600' },
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Square 0' }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });

        expect(fetchPalettePreview).toHaveBeenCalledExactlyOnceWith('#ffd600');
        expect(stage(container).style.getPropertyValue('--primary')).toBe(
            '#8f7500',
        );
        expect(stage(container).style.getPropertyValue('--radius')).toBe(
            '0rem',
        );
        expect(stage(container).classList.contains('dark')).toBe(false);

        fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

        expect(stage(container).classList.contains('dark')).toBe(true);
        expect(stage(container).style.getPropertyValue('--primary')).toBe(
            '#e3c22b',
        );
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('shows the field error for an invalid colour and keeps the preview', async () => {
        vi.useFakeTimers();

        const { container } = setup();

        fireEvent.change(screen.getByLabelText('Primary colour'), {
            target: { value: '#12' },
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });

        expect(
            screen.getByText(
                'Enter a hex colour with 3 or 6 digits, such as #2B63B0.',
            ),
        ).toBeTruthy();
        expect(fetchPalettePreview).not.toHaveBeenCalled();
        expect(stage(container).style.getPropertyValue('--primary')).toBe(
            '#2b63b0',
        );
    });
});

describe('BrandingForm reset', () => {
    it('lists what is lost and resets only after confirmation', async () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Reset to Skrüm' }));

        const dialog = screen.getByRole('alertdialog');

        expect(resetBranding).not.toHaveBeenCalled();
        expect(dialog.textContent).toContain(
            'The logos and the favicon are deleted.',
        );
        expect(dialog.textContent).toContain(
            'The GIF provider, rating and API key are deleted.',
        );

        fireEvent.click(
            Array.from(dialog.querySelectorAll('button')).find(
                (button) => button.textContent === 'Reset to Skrüm',
            ) as HTMLButtonElement,
        );

        await vi.waitFor(() => expect(resetBranding).toHaveBeenCalledOnce());
    });
});

describe('BrandingForm defaults', () => {
    function hints(container: HTMLElement): number {
        return container.querySelectorAll('[data-slot=default-hint]').length;
    }

    it('marks what follows the default and drops the mark once a field is changed', () => {
        const { container } = setup();

        expect(screen.getByText('Default: Skrüm')).toBeTruthy();
        expect(
            container.querySelector('[data-slot=avatar-style-default]'),
        ).not.toBeNull();
        expect(hints(container)).toBe(5);

        fireEvent.click(screen.getByRole('radio', { name: 'Fun Emoji' }));
        fireEvent.click(screen.getByRole('switch', { name: 'GIFs enabled' }));
        fireEvent.change(screen.getByLabelText('Display name'), {
            target: { value: 'Nordlys' },
        });

        expect(screen.queryByText('Default: Skrüm')).toBeNull();
        expect(
            container.querySelector('[data-slot=avatar-style-default]'),
        ).toBeNull();
        expect(hints(container)).toBe(3);
    });

    it('shows no mark on a stored value', () => {
        const { container } = setup({
            displayName: 'Nordlys',
            poweredBy: false,
            avatarStyle: 'fun-emoji',
            gifProvider: 'tenor',
            gifEnabled: true,
            gifRating: 'pg',
        });

        expect(hints(container)).toBe(0);
        expect(
            (screen.getByLabelText('Display name') as HTMLInputElement).value,
        ).toBe('Nordlys');
    });
});

describe('BrandingForm avatars', () => {
    it('states the attribution of a CC BY style once it is selected', () => {
        setup();

        expect(screen.queryByText(/requires attribution/)).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'Fun Emoji' }));

        expect(
            screen.getByText(
                'This style requires attribution, shown on the About page: Fun Emoji Set by Davis Uche, CC BY 4.0',
            ),
        ).toBeTruthy();
        expect(status()).toBe('1 unsaved change');
    });
});
