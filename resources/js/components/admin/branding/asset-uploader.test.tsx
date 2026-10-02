import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AssetUploader } from './asset-uploader';

function choose(container: HTMLElement, file: File): void {
    fireEvent.change(
        container.querySelector('input[type=file]') as HTMLInputElement,
        { target: { files: [file] } },
    );
}

function setup(url: string | null = null) {
    const onUpload = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const view = renderWithProviders(
        <AssetUploader
            label="Logo, light theme"
            url={url}
            onUpload={onUpload}
            onRemove={onRemove}
        />,
    );

    return { ...view, onUpload, onRemove };
}

describe('AssetUploader', () => {
    it('states the accepted types and the size limit', () => {
        const { container } = setup();

        expect(
            screen.getByText('PNG, JPEG, WebP or SVG, 512 KB at most.'),
        ).toBeTruthy();
        expect(
            container.querySelector('input[type=file]')?.getAttribute('accept'),
        ).toContain('image/svg+xml');
    });

    it('refuses a 600 KB file before any upload', () => {
        const { container, onUpload } = setup();

        choose(
            container,
            new File([new Uint8Array(600 * 1024)], 'logo.png', {
                type: 'image/png',
            }),
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'This file is larger than 512 KB.',
        );
        expect(onUpload).not.toHaveBeenCalled();
    });

    it('refuses a GIF before any upload', () => {
        const { container, onUpload } = setup();

        choose(container, new File(['x'], 'logo.gif', { type: 'image/gif' }));

        expect(screen.getByRole('alert').textContent).toBe(
            'Use a PNG, JPEG, WebP or SVG image.',
        );
        expect(onUpload).not.toHaveBeenCalled();
    });

    it('hands a valid file to the upload action and clears the refusal', () => {
        const { container, onUpload } = setup();
        const file = new File(['<svg/>'], 'logo.svg', {
            type: 'image/svg+xml',
        });

        choose(container, new File(['x'], 'logo.gif', { type: 'image/gif' }));
        choose(container, file);

        expect(onUpload).toHaveBeenCalledExactlyOnceWith(file);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows the current image through an img element and the server error', () => {
        const { container, rerender } = setup('/brand/logo-light?v=3');

        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/brand/logo-light?v=3',
        );
        expect(container.querySelector('svg image, object, embed')).toBeNull();

        rerender(
            <AssetUploader
                label="Logo, light theme"
                url="/brand/logo-light?v=3"
                error="The image is not valid."
                onUpload={vi.fn()}
                onRemove={vi.fn()}
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The image is not valid.',
        );
    });

    it('removes only after confirmation', async () => {
        const { onRemove } = setup('/brand/logo-light?v=3');

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        expect(onRemove).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog');

        fireEvent.click(
            Array.from(dialog.querySelectorAll('button')).find(
                (button) => button.textContent === 'Remove',
            ) as HTMLButtonElement,
        );

        await vi.waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
    });

    it('takes a dropped file like a chosen one', () => {
        const { container, onUpload } = setup();
        const file = new File(['x'], 'logo.png', { type: 'image/png' });

        fireEvent.drop(
            container.querySelector(
                '[data-slot=asset-drop-zone]',
            ) as HTMLElement,
            { dataTransfer: { files: [file] } },
        );

        expect(onUpload).toHaveBeenCalledExactlyOnceWith(file);
    });

    it('drops a staged file without confirmation and marks it as not saved', () => {
        const onRemove = vi.fn();

        renderWithProviders(
            <AssetUploader
                label="Light logo"
                url="blob:staged"
                fileName="atlas.png"
                staged
                onUpload={vi.fn()}
                onRemove={onRemove}
            />,
        );

        expect(screen.getByText('atlas.png')).toBeTruthy();
        expect(screen.getByText('Not saved')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(onRemove).toHaveBeenCalledOnce();
    });

    it('offers no removal without an image', () => {
        setup();

        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy();
    });
});
