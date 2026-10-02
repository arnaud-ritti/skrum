import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarStyleCard } from '@/components/settings/avatar-style-card';
import type { ProfileAvatarStyle } from '@/components/settings/avatar-style-card';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {} } }),
        router: { patch: mocks.patch },
    };
});

type VisitCallbacks = {
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const user = { name: 'Ada Lovelace', email: 'ada@example.com' };

const styles: ProfileAvatarStyle[] = [
    {
        value: 'thumbs',
        name: 'Thumbs',
        license: 'CC0 1.0',
        attribution: null,
        attributionRequired: false,
        sampleUrls: ['/avatars/thumbs/a.svg'],
    },
    {
        value: 'lorelei',
        name: 'Lorelei',
        license: 'CC0 1.0',
        attribution: 'Lorelei by Lisa Wischofsky, CC0 1.0',
        attributionRequired: false,
        sampleUrls: ['/avatars/lorelei/a.svg'],
    },
    {
        value: 'fun-emoji',
        name: 'Fun Emoji',
        license: 'CC BY 4.0',
        attribution: 'Fun Emoji Set by Davis Uche, CC BY 4.0',
        attributionRequired: true,
        sampleUrls: ['/avatars/fun-emoji/a.svg'],
    },
];

function saveButton(): HTMLButtonElement {
    return screen.getByRole<HTMLButtonElement>('button', {
        name: 'Save avatar style',
    });
}

beforeEach(() => {
    mocks.patch.mockReset();
});

describe('AvatarStyleCard', () => {
    it('renders nothing when members cannot choose', () => {
        const { container } = renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice={false}
                style={null}
                instanceStyle="thumbs"
                styles={[]}
            />,
        );

        expect(container.innerHTML).toBe('');
    });

    it('starts on the instance style when the member chose none', () => {
        renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice
                style={null}
                instanceStyle="thumbs"
                styles={styles}
            />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Thumbs' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(saveButton().disabled).toBe(true);
        expect(
            screen.getByRole('heading', { level: 2, name: 'Avatar style' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Use the instance style' }),
        ).toBeNull();
        expect(screen.queryByRole('switch')).toBeNull();
    });

    it('submits the chosen style with the unchanged name and email', () => {
        renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice
                style={null}
                instanceStyle="thumbs"
                styles={styles}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Lorelei' }));
        fireEvent.click(saveButton());

        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.patch.mock.calls[0][0]).toBe('/settings/profile');
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            avatar_style: 'lorelei',
        });
    });

    it('sends null to return to the instance style', () => {
        renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice
                style="lorelei"
                instanceStyle="thumbs"
                styles={styles}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Use the instance style' }),
        );

        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            avatar_style: null,
        });
    });

    it('shows the attribution only for a style that requires it', () => {
        renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice
                style={null}
                instanceStyle="thumbs"
                styles={styles}
            />,
        );

        expect(
            screen.getByText('Fun Emoji Set by Davis Uche, CC BY 4.0'),
        ).toBeTruthy();
        expect(
            screen.queryByText('Lorelei by Lisa Wischofsky, CC0 1.0'),
        ).toBeNull();
    });

    it('shows the refusal of the server', () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitCallbacks) => {
                options.onError?.({
                    avatar_style: 'The selected avatar style is invalid.',
                });
                options.onFinish?.();
            },
        );
        renderWithProviders(
            <AvatarStyleCard
                user={user}
                memberChoice
                style={null}
                instanceStyle="thumbs"
                styles={styles}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Lorelei' }));
        fireEvent.click(saveButton());

        expect(screen.getByRole('alert').textContent).toBe(
            'The selected avatar style is invalid.',
        );
    });
});
