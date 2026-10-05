import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());
const reload = vi.hoisted(() => vi.fn());
const isMobile = vi.hoisted(() => ({ value: false }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post, reload },
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => isMobile.value,
}));

beforeEach(() => {
    post.mockClear();
    reload.mockReset();
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

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/join/abc',
            { name: 'Guest Gia' },
            expect.anything(),
        );
    });

    it('joins a survey under the survey kind', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="survey"
                invalidTitle="Join a survey"
                session={{ title: 'Team pulse' }}
                storeUrl="/surveys/join/abc"
                suggestedName="Guest Gia"
            />,
        );

        expect(
            document
                .querySelector('[data-slot="guest-join-session"]')
                ?.getAttribute('data-kind'),
        ).toBe('survey');

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/surveys/join/abc',
            { name: 'Guest Gia' },
            expect.anything(),
        );
    });

    it('asks the server for another random nickname and puts it in the field', () => {
        reload.mockImplementation(
            (options: {
                onSuccess: (page: { props: Record<string, unknown> }) => void;
            }) => options.onSuccess({ props: { randomName: 'Brave heron' } }),
        );

        renderWithProviders(
            <GuestJoinPage
                kind="whiteboard"
                invalidTitle="Join a whiteboard"
                session={{ title: 'Sprint board' }}
                storeUrl="/whiteboards/join/abc"
                suggestedName="Thoughtful otter"
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Another random nickname' }),
        );

        expect(reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['randomName'] }),
        );
        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Brave heron',
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/whiteboards/join/abc',
            { name: 'Brave heron' },
            expect.anything(),
        );
    });

    it('keeps the nickname when the server sends no other one', () => {
        reload.mockImplementation(
            (options: {
                onSuccess: (page: { props: Record<string, unknown> }) => void;
            }) => options.onSuccess({ props: {} }),
        );

        renderWithProviders(
            <GuestJoinPage
                kind="poker"
                invalidTitle="Join a planning poker game"
                session={{ title: 'Sprint 12 estimates' }}
                storeUrl="/poker/join/abc"
                suggestedName="Thoughtful otter"
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Another random nickname' }),
        );

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Thoughtful otter',
        );
    });

    it('keeps what was typed and shows the error when a refused join comes back with another suggested nickname', () => {
        const props = {
            kind: 'retro',
            invalidTitle: 'Join a retrospective',
            session: { title: 'Sprint 42 retro' },
            storeUrl: '/join/abc',
        } as const;

        const { rerender } = renderWithProviders(
            <GuestJoinPage {...props} suggestedName="Thoughtful otter" />,
        );

        fireEvent.change(screen.getByLabelText('Your nickname'), {
            target: { value: 'Théo' },
        });

        page.props = {
            ...page.props,
            errors: { name: 'The name has already been taken.' },
        };

        rerender(<GuestJoinPage {...props} suggestedName="Brave heron" />);

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Théo',
        );
        expect(
            screen.getByText('The name has already been taken.'),
        ).toBeTruthy();
    });

    it('announces the drawn nickname to screen readers', () => {
        reload.mockImplementation(
            (options: {
                onSuccess: (page: { props: Record<string, unknown> }) => void;
            }) => options.onSuccess({ props: { randomName: 'Brave heron' } }),
        );

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Thoughtful otter"
            />,
        );

        expect(screen.getByRole('status').textContent).toBe('');

        fireEvent.click(
            screen.getByRole('button', { name: 'Another random nickname' }),
        );

        expect(screen.getByRole('status').textContent).toBe('Brave heron');
    });

    it('draws one nickname at a time', () => {
        reload.mockImplementation((options: { onStart: () => void }) =>
            options.onStart(),
        );

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Thoughtful otter"
            />,
        );

        const draw = screen.getByRole('button', {
            name: 'Another random nickname',
        });

        fireEvent.click(draw);
        fireEvent.click(draw);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(draw.getAttribute('aria-disabled')).toBe('true');
    });

    it('says that cards are anonymous only for a retro that has anonymous cards', () => {
        const { unmount } = renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro', hasAnonymousCards: true }}
                storeUrl="/join/abc"
            />,
        );

        expect(
            screen.getByText(/Cards are anonymous in this retro\./),
        ).toBeTruthy();

        unmount();

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro', hasAnonymousCards: false }}
                storeUrl="/join/abc"
            />,
        );

        expect(
            screen.queryByText(/Cards are anonymous in this retro\./),
        ).toBeNull();
        expect(
            screen.getByText(
                'No account and no email needed. The others see your nickname.',
            ),
        ).toBeTruthy();
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

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

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

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

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
        expect(
            screen.queryByRole('button', { name: 'Join the session' }),
        ).toBeNull();
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

    it('offers the colours, disables the taken ones, selects the first free one and posts it', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Guest Gia"
                takenColors={[1, 5]}
            />,
        );

        expect(
            screen.getByRole('radiogroup', { name: 'Avatar colour' }),
        ).toBeTruthy();

        for (const taken of [1, 5]) {
            expect(
                screen
                    .getByRole('radio', { name: `Colour ${taken} (taken)` })
                    .getAttribute('aria-disabled'),
            ).toBe('true');
        }

        expect(
            screen
                .getByRole('radio', { name: 'Colour 2' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/join/abc',
            { name: 'Guest Gia', presence: 2 },
            expect.anything(),
        );
    });

    it('selects the suggested colour first and posts the one picked', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="poker"
                invalidTitle="Join a planning poker game"
                session={{ title: 'Sprint 12 estimates' }}
                storeUrl="/poker/join/abc"
                suggestedName="Guest Gia"
                takenColors={[2, 5]}
                suggestedPresence={7}
            />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Colour 7' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Colour 9' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/poker/join/abc',
            { name: 'Guest Gia', presence: 9 },
            expect.anything(),
        );
    });

    it('offers no colour when the page sends no taken colours', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Guest Gia"
            />,
        );

        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('lays the colours out as a 6 × 2 grid of 48 px targets on a phone', () => {
        isMobile.value = true;

        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                takenColors={[]}
            />,
        );

        expect(
            screen
                .getByRole('radiogroup', { name: 'Avatar colour' })
                .classList.contains('grid-cols-6'),
        ).toBe(true);
        expect(
            screen
                .getByRole('radio', { name: 'Colour 1' })
                .classList.contains('size-12'),
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
