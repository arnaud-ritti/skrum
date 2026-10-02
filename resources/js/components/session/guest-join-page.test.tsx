import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());
const isMobile = vi.hoisted(() => ({ value: false }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post },
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => isMobile.value,
}));

beforeEach(() => {
    post.mockClear();
    isMobile.value = false;
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

describe('GuestJoinPage', () => {
    it('prefills the nickname and posts it to the join URL', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Guest Gia"
            />,
        );

        const field = document.querySelector<HTMLInputElement>('#name');

        expect(field?.value).toBe('Guest Gia');

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(post).toHaveBeenCalledWith(
            '/join/abc',
            { name: 'Guest Gia' },
            expect.anything(),
        );
    });

    it('sends the extra fields of the form, such as the poker spectator choice', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="poker"
                invalidTitle="Join a planning poker game"
                session={{ title: 'Sprint 12 estimates' }}
                storeUrl="/poker/join/abc"
                suggestedName="Guest Gia"
                extraFields={['spectator']}
            >
                <input
                    type="checkbox"
                    id="spectator"
                    name="spectator"
                    value="1"
                    defaultChecked
                />
            </GuestJoinPage>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(post).toHaveBeenCalledWith(
            '/poker/join/abc',
            { name: 'Guest Gia', spectator: '1' },
            expect.anything(),
        );
    });

    it('shows the server error under the nickname', () => {
        page.props = {
            ...page.props,
            errors: { name: 'The name field is required.' },
        };

        renderWithProviders(
            <GuestJoinPage
                kind="game"
                invalidTitle="Join a game"
                session={{ title: 'Warm-up' }}
                storeUrl="/play/abc"
            />,
        );

        expect(screen.getByText('The name field is required.')).toBeTruthy();
    });

    it('releases the server error once the nickname is edited', () => {
        page.props = {
            ...page.props,
            errors: { name: 'The name has already been taken.' },
        };

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Théo"
            />,
        );

        fireEvent.change(screen.getByLabelText('Your nickname'), {
            target: { value: 'Théo B.' },
        });

        expect(
            screen.queryByText('The name has already been taken.'),
        ).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(post).toHaveBeenCalledWith(
            '/join/abc',
            { name: 'Théo B.' },
            expect.anything(),
        );
    });

    it('shows the invalid-link notice and no form when the link is gone', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="whiteboard"
                invalidTitle="Join a whiteboard"
                session={null}
                storeUrl={null}
            />,
        );

        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(document.querySelector('#name')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
    });

    it('titles the page with the session, or with the invalid title', () => {
        const { unmount } = renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
            />,
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42 retro',
        );

        unmount();

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={null}
                storeUrl={null}
            />,
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Join a retrospective',
        );
    });

    it('shows the facilitator, the participants and the live status when the server sends them', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{
                    title: 'Sprint 42 retro',
                    facilitatorName: 'Camille',
                    participantsCount: 9,
                    isLive: true,
                }}
                storeUrl="/join/abc"
            />,
        );

        expect(screen.getByText('Camille facilitates')).toBeTruthy();
        expect(screen.getByText('9 participants')).toBeTruthy();
        expect(screen.getByText('Live')).toBeTruthy();
    });

    it('shows none of those lines when the server sends none', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro', facilitatorName: null }}
                storeUrl="/join/abc"
            />,
        );

        expect(
            document.querySelectorAll(
                '[data-slot="guest-join-session"] [data-slot^="guest-join-"]',
            ),
        ).toHaveLength(0);
    });

    it('pins the join button on a phone only', () => {
        isMobile.value = true;

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
            />,
        );

        expect(
            document
                .querySelector('[data-slot="guest-join-action"]')
                ?.classList.contains('sticky'),
        ).toBe(true);
    });

    it('shows one logo, the one of the frame, so a rebranded instance never shows the Skrüm mark in the card', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
            />,
        );

        expect(screen.getAllByRole('img', { name: 'Skrüm' })).toHaveLength(1);
        expect(
            document.querySelector('[data-slot="guest-join"] [role="img"]'),
        ).toBeNull();
    });
});
