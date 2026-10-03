import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePhoto } from '@/components/settings/profile-photo';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    toSquareJpeg: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {} } }),
        router: { post: mocks.post, delete: mocks.delete },
    };
});

vi.mock('@/lib/settings/square-crop', () => ({
    toSquareJpeg: mocks.toSquareJpeg,
}));

type VisitOptions = {
    data?: Record<string, unknown>;
    forceFormData?: boolean;
    onStart?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const cropped = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });

function chooseFile(file: File): void {
    const input = document.querySelector<HTMLInputElement>(
        '[data-slot="profile-photo-input"]',
    );

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.delete.mockReset();
    mocks.toSquareJpeg.mockReset();
    mocks.toSquareJpeg.mockResolvedValue(cropped);
});

describe('ProfilePhoto', () => {
    it('renders nothing while the instance does not allow photos', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed={false}
                hasPhoto
                memberChoice
                style="thumbs"
            />,
        );

        expect(
            document.querySelector('[data-slot="profile-photo"]'),
        ).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('crops the chosen file and uploads it', async () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice
                style="thumbs"
            />,
        );
        const original = new File(['png'], 'me.png', { type: 'image/png' });

        expect(
            document
                .querySelector('[data-slot="profile-photo-input"]')
                ?.getAttribute('accept'),
        ).toBe('image/jpeg,image/png');

        chooseFile(original);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.toSquareJpeg).toHaveBeenCalledWith(original);

        const [url, data, options] = mocks.post.mock.calls[0] as [
            string,
            { photo: File },
            VisitOptions,
        ];

        expect(url).toBe('/settings/profile/photo');
        expect(data.photo).toBe(cropped);
        expect(options.forceFormData).toBe(true);
    });

    it('sends a file of another type as it is, for the server to refuse', async () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice
                style="thumbs"
            />,
        );
        const gif = new File(['gif'], 'me.gif', { type: 'image/gif' });

        chooseFile(gif);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.toSquareJpeg).not.toHaveBeenCalled();
        expect((mocks.post.mock.calls[0][1] as { photo: File }).photo).toBe(
            gif,
        );
    });

    it('shows the upload busy while it is in flight, then the refusal under the buttons', async () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice
                style="thumbs"
            />,
        );

        chooseFile(new File(['png'], 'me.png', { type: 'image/png' }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        const options = mocks.post.mock.calls[0][2] as VisitOptions;

        await waitFor(() =>
            expect(
                screen
                    .getByRole('button', { name: /Upload photo/ })
                    .getAttribute('aria-busy'),
            ).toBe('true'),
        );

        options.onError?.({
            photo: 'This image could not be read. Choose a JPEG or PNG file.',
        });
        options.onFinish?.();

        expect((await screen.findByRole('alert')).textContent).toBe(
            'This image could not be read. Choose a JPEG or PNG file.',
        );
        await waitFor(() =>
            expect(
                screen
                    .getByRole('button', { name: /Upload photo/ })
                    .getAttribute('aria-busy'),
            ).not.toBe('true'),
        );
    });

    it('goes back to initials, setting the style, while members choose their style', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto
                memberChoice
                style="initials"
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Use initials' }));

        const [url, options] = mocks.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toBe('/settings/profile/photo');
        expect(options.data).toEqual({ initials: true });
        expect(
            screen.queryByRole('button', { name: 'Remove photo' }),
        ).toBeNull();
    });

    it('offers "Use initials" without a photo while the style is not initials', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice
                style="thumbs"
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Use initials' }),
        ).toBeTruthy();
    });

    it('hides "Use initials" without a photo while the style is already initials', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice
                style="initials"
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Use initials' }),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: /Upload photo/ }),
        ).toBeTruthy();
    });

    it('only removes the photo while members cannot choose their style', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto
                memberChoice={false}
                style="thumbs"
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Use initials' }),
        ).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));

        const options = mocks.delete.mock.calls[0][1] as VisitOptions;

        expect(options.data).toBeUndefined();
    });

    it('offers no removal without a photo while members cannot choose their style', () => {
        renderWithProviders(
            <ProfilePhoto
                photosAllowed
                hasPhoto={false}
                memberChoice={false}
                style="thumbs"
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Remove photo' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Use initials' }),
        ).toBeNull();
    });

    it('never submits the profile form around it', () => {
        renderWithProviders(
            <form data-testid="profile">
                <ProfilePhoto
                    photosAllowed
                    hasPhoto
                    memberChoice
                    style="thumbs"
                />
            </form>,
        );

        for (const button of screen.getAllByRole('button')) {
            expect(button.getAttribute('type')).toBe('button');
        }

        expect(
            document
                .querySelector('[data-slot="profile-photo-input"]')
                ?.hasAttribute('name'),
        ).toBe(false);
    });
});
