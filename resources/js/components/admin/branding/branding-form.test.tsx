import { router } from '@inertiajs/react';
import { act, fireEvent, screen, within } from '@testing-library/react';
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
    return (
        document.querySelector('[data-slot=unsaved-bar] [role=status]')
            ?.textContent ?? ''
    );
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

        const name = screen.getByLabelText(
            'Branding display name',
        ) as HTMLInputElement;

        fireEvent.change(name, { target: { value: 'Nordlys' } });

        expect(status()).toBe('1 unsaved change');

        fireEvent.change(name, { target: { value: 'Nordlys Retro' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Round' }));
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
                .getByRole('radio', { name: 'Standard' })
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

describe('BrandingForm profile photos', () => {
    it('saves the switch "Profile photos" with the other fields', async () => {
        const visit = vi.spyOn(router, 'visit').mockImplementation(() => {});
        setup();

        const photos = screen.getByRole('switch', { name: 'Profile photos' });

        expect(photos.getAttribute('aria-checked')).toBe('false');

        fireEvent.click(photos);

        expect(status()).toBe('1 unsaved change');

        await act(async () => {
            fireEvent.submit(screen.getByRole('form', { name: 'Branding' }));
        });

        expect(visit.mock.calls[0][1]?.data).toMatchObject({
            profile_photos: true,
        });

        visit.mockRestore();
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
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        let created = 0;

        createObjectURL
            .mockReset()
            .mockImplementation(() => `blob:staged-${++created}`);
        revokeObjectURL.mockReset();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
    });

    function png(name = 'logo.png'): File {
        return new File(['x'], name, { type: 'image/png' });
    }

    function choose(container: HTMLElement, file: File): void {
        fireEvent.change(
            container.querySelector('input[type=file]') as HTMLInputElement,
            { target: { files: [file] } },
        );
    }

    function previewLogo(container: HTMLElement): string | null {
        return (
            container
                .querySelector('[data-slot=brand-preview-logo]')
                ?.getAttribute('src') ?? null
        );
    }

    async function submit(): Promise<void> {
        await act(async () => {
            fireEvent.submit(screen.getByRole('form', { name: 'Branding' }));
        });
    }

    it('offers one drop zone with the choice of the image above it', () => {
        const { container } = setup();

        expect(
            container.querySelectorAll('[data-slot=asset-uploader]'),
        ).toHaveLength(1);
        expect(
            within(screen.getByRole('radiogroup', { name: 'Logo' }))
                .getAllByRole('radio')
                .map((item) => item.textContent),
        ).toEqual(['Light logo', 'Dark logo', 'Favicon', 'Logo for emails']);
    });

    it('offers a logo for e-mails with its own format line', async () => {
        const { container } = setup();
        const file = png();

        fireEvent.click(screen.getByRole('radio', { name: 'Logo for emails' }));

        expect(
            screen.getByText(
                'PNG or JPEG, at least 128 px wide. Mail clients do not draw SVG.',
            ),
        ).toBeTruthy();
        expect(container.querySelector('[data-slot=asset-warning]')).toBeNull();

        choose(container, file);
        await submit();

        expect(uploadAsset).toHaveBeenCalledExactlyOnceWith('logo-mail', file);
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
            'Emails show the name as text until a PNG or JPEG logo is added.',
        );
    });

    it('warns only under the images that give e-mails a logo', () => {
        const { container } = setup({
            assets: {
                logoLightUrl: '/brand/logo-light?v=1',
                logoDarkUrl: null,
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: true,
            },
        });
        const warned = (image: string): boolean => {
            fireEvent.click(screen.getByRole('radio', { name: image }));

            return (
                container.querySelector('[data-slot=asset-warning]') !== null
            );
        };

        expect(warned('Dark logo')).toBe(false);
        expect(warned('Favicon')).toBe(false);
        expect(warned('Logo for emails')).toBe(true);
        expect(warned('Light logo')).toBe(true);
    });

    it('locks the fields, the images and the reset while it saves', async () => {
        let finishUpload: () => void = () => undefined;

        vi.mocked(uploadAsset).mockReturnValue(
            new Promise<void>((resolve) => {
                finishUpload = resolve;
            }),
        );

        const { container } = setup();

        choose(container, png());
        await submit();

        expect(
            screen.getByLabelText('Branding display name').matches(':disabled'),
        ).toBe(true);
        expect(
            container.querySelector('input[type=file]')?.matches(':disabled'),
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Back to Skrüm',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        await submit();

        expect(uploadAsset).toHaveBeenCalledOnce();

        await act(async () => finishUpload());

        expect(
            screen.getByLabelText('Branding display name').matches(':disabled'),
        ).toBe(false);
    });

    it('says that a removal waits for Save and what is shown instead', () => {
        setup({
            assets: {
                logoLightUrl: null,
                logoDarkUrl: '/brand/logo-dark?v=1',
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: false,
            },
        });

        fireEvent.click(screen.getByRole('radio', { name: 'Dark logo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        expect(screen.getByRole('alertdialog').textContent).toContain(
            'Dark logo is removed when you save. The light logo is used instead.',
        );
    });

    it('counts a staged file as an unsaved change and shows it in the preview without sending it', () => {
        const { container } = setup();

        choose(container, png('atlas.png'));

        expect(status()).toBe('1 unsaved change');
        expect(saveButton().disabled).toBe(false);
        expect(uploadAsset).not.toHaveBeenCalled();
        expect(previewLogo(container)).toBe('blob:staged-1');
        expect(
            container.querySelector('[data-slot=asset-name]')?.textContent,
        ).toBe('atlas.png');

        fireEvent.change(screen.getByLabelText('Branding display name'), {
            target: { value: 'Nordlys' },
        });

        expect(status()).toBe('2 unsaved changes');
    });

    it('drops the staged file on Cancel and revokes its object URL', () => {
        const { container } = setup();

        choose(container, png());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
            'blob:staged-1',
        );
        expect(previewLogo(container)).toBeNull();
        expect(uploadAsset).not.toHaveBeenCalled();
    });

    it('revokes the object URL of a file that is replaced', () => {
        const { container } = setup();

        choose(container, png('first.png'));
        choose(container, png('second.png'));

        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
            'blob:staged-1',
        );
        expect(previewLogo(container)).toBe('blob:staged-2');
        expect(status()).toBe('1 unsaved change');
    });

    it('sends the staged file of the chosen image on Save', async () => {
        const { container } = setup();
        const file = png();

        fireEvent.click(screen.getByRole('radio', { name: 'Dark logo' }));
        choose(container, file);

        expect(uploadAsset).not.toHaveBeenCalled();

        await submit();

        expect(uploadAsset).toHaveBeenCalledExactlyOnceWith('logo-dark', file);
        expect(status()).toBe('No unsaved changes');
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
            'blob:staged-1',
        );
    });

    it('sends the staged image before the changed fields', async () => {
        const visit = vi.spyOn(router, 'visit').mockImplementation(() => {});
        const { container } = setup();

        choose(container, png());
        fireEvent.change(screen.getByLabelText('Branding display name'), {
            target: { value: 'Nordlys' },
        });

        await submit();

        expect(uploadAsset).toHaveBeenCalledOnce();
        expect(visit).toHaveBeenCalledOnce();
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(vi.mocked(uploadAsset).mock.invocationCallOrder[0]).toBeLessThan(
            visit.mock.invocationCallOrder[0],
        );

        visit.mockRestore();
    });

    it('does not send the fields when an image is refused', async () => {
        const visit = vi.spyOn(router, 'visit').mockImplementation(() => {});
        vi.mocked(uploadAsset).mockRejectedValueOnce(
            new BrandingVisitError({ file: 'The image is not valid.' }),
        );

        const { container } = setup();

        choose(container, png());
        fireEvent.change(screen.getByLabelText('Branding display name'), {
            target: { value: 'Nordlys' },
        });

        await submit();

        expect(visit).not.toHaveBeenCalled();
        expect(status()).toBe('2 unsaved changes');

        visit.mockRestore();
    });

    it('stages nothing for a 600 KB file or a GIF', () => {
        const { container } = setup();

        choose(
            container,
            new File([new Uint8Array(600 * 1024)], 'logo.png', {
                type: 'image/png',
            }),
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'This file is larger than 512 KB.',
        );

        choose(container, new File(['x'], 'logo.gif', { type: 'image/gif' }));

        expect(screen.getByRole('alert').textContent).toBe(
            'Use a PNG, JPEG, WebP or SVG image.',
        );
        expect(status()).toBe('No unsaved changes');
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('shows the server refusal under the drop zone and keeps the file staged', async () => {
        vi.mocked(uploadAsset).mockRejectedValueOnce(
            new BrandingVisitError({ file: 'The image is not valid.' }),
        );

        const { container } = setup();

        fireEvent.click(screen.getByRole('radio', { name: 'Favicon' }));
        choose(container, png('icon.png'));
        fireEvent.click(screen.getByRole('radio', { name: 'Light logo' }));

        await submit();

        const alert = await screen.findByRole('alert');

        expect(alert.textContent).toBe('The image is not valid.');
        expect(
            screen
                .getByRole('radio', { name: 'Favicon' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(status()).toBe('1 unsaved change');
        expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it('stages the removal of a stored image and deletes it on Save', async () => {
        const { container } = setup({
            assets: {
                logoLightUrl: '/brand/logo-light?v=3',
                logoDarkUrl: null,
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: false,
            },
        });

        expect(previewLogo(container)).toBe('/brand/logo-light?v=3');

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        fireEvent.click(
            Array.from(
                screen.getByRole('alertdialog').querySelectorAll('button'),
            ).find(
                (button) => button.textContent === 'Remove',
            ) as HTMLButtonElement,
        );

        await vi.waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );

        expect(status()).toBe('1 unsaved change');
        expect(removeAsset).not.toHaveBeenCalled();
        expect(previewLogo(container)).toBeNull();

        await submit();

        expect(removeAsset).toHaveBeenCalledExactlyOnceWith('logo-light');
        expect(uploadAsset).not.toHaveBeenCalled();
    });
});

describe('BrandingForm image undo', () => {
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        let created = 0;

        revokeObjectURL.mockReset();
        URL.createObjectURL = vi.fn(() => `blob:undo-${++created}`);
        URL.revokeObjectURL = revokeObjectURL;
    });

    function previewLogo(container: HTMLElement): string | null {
        return (
            container
                .querySelector('[data-slot=brand-preview-logo]')
                ?.getAttribute('src') ?? null
        );
    }

    async function removeStoredImage(): Promise<void> {
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        fireEvent.click(
            Array.from(
                screen.getByRole('alertdialog').querySelectorAll('button'),
            ).find(
                (button) => button.textContent === 'Remove',
            ) as HTMLButtonElement,
        );

        await vi.waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    }

    it('undoes one staged removal and keeps the other staged image', async () => {
        const { container } = setup({
            assets: {
                logoLightUrl: '/brand/logo-light?v=3',
                logoDarkUrl: null,
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: false,
            },
        });

        await removeStoredImage();

        fireEvent.click(screen.getByRole('radio', { name: 'Favicon' }));
        fireEvent.change(
            container.querySelector('input[type=file]') as HTMLInputElement,
            {
                target: {
                    files: [new File(['x'], 'icon.png', { type: 'image/png' })],
                },
            },
        );

        expect(status()).toBe('2 unsaved changes');

        fireEvent.click(screen.getByRole('radio', { name: 'Light logo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(status()).toBe('1 unsaved change');
        expect(previewLogo(container)).toBe('/brand/logo-light?v=3');
        expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
        expect(revokeObjectURL).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.submit(screen.getByRole('form', { name: 'Branding' }));
        });

        expect(removeAsset).not.toHaveBeenCalled();
        expect(uploadAsset).toHaveBeenCalledExactlyOnceWith(
            'favicon',
            expect.any(File),
        );
    });

    it('undoes a staged file, which shows the stored image again', () => {
        const { container } = setup({
            assets: {
                logoLightUrl: '/brand/logo-light?v=3',
                logoDarkUrl: null,
                faviconUrl: null,
                logoMailUrl: null,
                mailShowsName: false,
            },
        });

        fireEvent.change(
            container.querySelector('input[type=file]') as HTMLInputElement,
            {
                target: {
                    files: [new File(['x'], 'new.png', { type: 'image/png' })],
                },
            },
        );

        expect(previewLogo(container)).toBe('blob:undo-1');

        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(status()).toBe('No unsaved changes');
        expect(previewLogo(container)).toBe('/brand/logo-light?v=3');
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:undo-1');
    });
});

describe('BrandingForm radius', () => {
    it('shows the exact value of a stored radius outside the segments and saves nothing until it changes', () => {
        setup({ brandRadius: 6 });

        const group = screen.getByRole('radiogroup', {
            name: 'Branding corners',
        });

        expect(
            within(group)
                .getAllByRole('radio')
                .filter((item) => item.getAttribute('aria-checked') === 'true'),
        ).toEqual([]);
        expect(
            (
                screen.getByRole('spinbutton', {
                    name: 'Exact radius in pixels',
                }) as HTMLInputElement
            ).value,
        ).toBe('6');
        expect(status()).toBe('No unsaved changes');

        fireEvent.click(within(group).getByRole('radio', { name: 'Soft' }));

        expect(status()).toBe('1 unsaved change');
        expect(screen.getByRole('spinbutton')).toBeTruthy();
    });

    it('has no exact field for a stored segment value', () => {
        setup({ brandRadius: 8 });

        expect(screen.queryByRole('spinbutton')).toBeNull();
    });

    it('shows Standard, as the mockup, while the default of 10 pixels applies', () => {
        setup({ brandRadius: null });

        expect(
            screen
                .getByRole('radio', { name: 'Standard' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.queryByRole('spinbutton')).toBeNull();
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
        fireEvent.click(screen.getByRole('radio', { name: 'Square' }));

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

describe('BrandingForm preview', () => {
    it('keeps the sample controls of the preview out of the tab order', () => {
        const { container } = setup();

        expect(stage(container).hasAttribute('inert')).toBe(true);
    });
});

describe('BrandingForm reset', () => {
    it('lists what is lost and resets only after confirmation', async () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Back to Skrüm' }));

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

    it('also lists the profile photos and the "Powered by" mention', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Back to Skrüm' }));

        const dialog = screen.getByRole('alertdialog');

        expect(dialog.textContent).toContain(
            'Profile photos and "Powered by Skrüm" return to the default.',
        );
        expect(dialog.textContent).toContain(
            'The colour and the radius return to the default.',
        );
    });

    it('drops the edits not saved yet once the reset is done', async () => {
        setup();

        const name = screen.getByLabelText(
            'Branding display name',
        ) as HTMLInputElement;

        fireEvent.change(name, { target: { value: 'Nordlys' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to Skrüm' }));
        fireEvent.click(
            Array.from(
                screen.getByRole('alertdialog').querySelectorAll('button'),
            ).find(
                (button) => button.textContent === 'Reset to Skrüm',
            ) as HTMLButtonElement,
        );

        await vi.waitFor(() => expect(status()).toBe('No unsaved changes'));
        expect(
            (screen.getByLabelText('Branding display name') as HTMLInputElement)
                .value,
        ).toBe('');
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
        fireEvent.change(screen.getByLabelText('Branding display name'), {
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
            (screen.getByLabelText('Branding display name') as HTMLInputElement)
                .value,
        ).toBe('Nordlys');
    });
});

describe('BrandingForm bar placement', () => {
    it('hands the bar and the form to the frame, and Save submits the form from outside it', () => {
        renderWithProviders(
            <BrandingForm
                {...sampleProps()}
                adminName="Ada Admin"
                frame={(bar, content) => (
                    <>
                        <header>{bar}</header>
                        <main>{content}</main>
                    </>
                )}
            />,
        );

        const save = within(screen.getByRole('banner')).getByRole('button', {
            name: 'Save',
        });

        expect(save.getAttribute('form')).toBe(
            screen.getByRole('form', { name: 'Branding' }).id,
        );
        expect(
            within(screen.getByRole('main')).queryByRole('button', {
                name: 'Save',
            }),
        ).toBeNull();
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
