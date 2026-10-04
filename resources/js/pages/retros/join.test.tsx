import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import JoinRetro from './join';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());
const head = vi.hoisted(() => ({ title: '' }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post },
    Head: ({ title }: { title: string }) => {
        head.title = title;

        return null;
    },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const session = {
    title: 'Sprint 42 retro',
    facilitatorName: 'Fran Facilitator',
    participantsCount: 3,
    isLive: true,
    hasAnonymousCards: false,
};

beforeEach(() => {
    post.mockClear();
    head.title = '';
    page.props = {
        translations: {},
        locale: 'en',
        locales: ['en'],
        errors: {},
        brand: {
            name: 'Skrüm',
            logoLightUrl: null,
            logoDarkUrl: null,
            faviconUrl: null,
            poweredBy: true,
        },
    };
});

describe('retros/join page', () => {
    it('shows the retro, its facilitator and the people present, and posts the nickname to the guest link', () => {
        renderWithProviders(
            <JoinRetro
                isInvalid={false}
                guestToken="tok-123"
                session={session}
                suggestedName="Guest Gia"
            />,
        );

        expect(head.title).toBe('Sprint 42 retro');
        expect(
            screen.getByRole('heading', { level: 1, name: 'Sprint 42 retro' }),
        ).toBeTruthy();
        expect(
            document.querySelector('[data-slot="guest-join"]')?.textContent,
        ).toContain('Sprint 42 retro');
        expect(screen.getByText(/Fran Facilitator/)).toBeTruthy();
        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Guest Gia',
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/join/tok-123',
            { name: 'Guest Gia' },
            expect.anything(),
        );
    });

    it('shows the server error under the nickname', () => {
        page.props = {
            ...page.props,
            errors: { name: 'The name field is required.' },
        };

        renderWithProviders(
            <JoinRetro
                isInvalid={false}
                guestToken="tok-123"
                session={session}
                suggestedName="Guest Gia"
            />,
        );

        expect(screen.getByText('The name field is required.')).toBeTruthy();
    });

    it('tells that the guest link is no longer valid, without a form', () => {
        renderWithProviders(<JoinRetro isInvalid />);

        expect(head.title).toBe('Join a retrospective');
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Join a retrospective',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(document.querySelector('#name')).toBeNull();
    });
    it('offers the colours left free, the suggested one first, and posts the colour', () => {
        renderWithProviders(
            <JoinRetro
                isInvalid={false}
                guestToken="tok-123"
                session={session}
                suggestedName="Guest Gia"
                takenColors={[2, 5]}
                suggestedPresence={7}
            />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Colour 2 (taken)' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: 'Colour 7' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/join/tok-123',
            { name: 'Guest Gia', presence: 7 },
            expect.anything(),
        );
    });
});
