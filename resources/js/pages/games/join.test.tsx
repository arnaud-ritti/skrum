import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameJoinsController from '@/actions/App/Http/Controllers/GameJoinsController';
import JoinGameRoom from '@/pages/games/join';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());
const headTitles = vi.hoisted(() => [] as string[]);

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post },
    Head: ({ title }: { title: string }) => {
        headTitles.push(title);

        return null;
    },
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

const session = {
    title: 'Friday fun',
    gameLabel: 'Hangman',
    facilitatorName: 'Ada Lovelace',
    participantsCount: 3,
    isLive: true,
};

beforeEach(() => {
    post.mockClear();
    headTitles.length = 0;
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

describe('games/join', () => {
    it('shows the room, its game, its host, its players and its state in the session card', () => {
        renderWithProviders(
            <JoinGameRoom
                isInvalid={false}
                guestToken="abc"
                session={session}
                suggestedName="Happy Otter"
            />,
        );

        const card = document.querySelector<HTMLElement>(
            '[data-slot="guest-join-session"]',
        );

        expect(card?.dataset.kind).toBe('game');
        expect(card?.dataset.status).toBe('live');
        expect(card?.textContent).toContain('Friday fun');
        expect(card?.textContent).toContain('Hangman');
        expect(card?.textContent).toContain('3 participants');
        expect(card?.textContent).toContain('Ada Lovelace facilitates');
        expect(headTitles).toEqual(['Friday fun']);
    });

    it('prefills the suggested nickname and posts it to the join route of the room', () => {
        renderWithProviders(
            <JoinGameRoom
                isInvalid={false}
                guestToken="abc"
                session={session}
                suggestedName="Happy Otter"
            />,
        );

        expect(
            screen.getByLabelText<HTMLInputElement>('Your nickname').value,
        ).toBe('Happy Otter');

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            GameJoinsController.store.url('abc'),
            { name: 'Happy Otter' },
            expect.anything(),
        );
    });

    it('shows the notice of an invalid link and no form', () => {
        renderWithProviders(<JoinGameRoom isInvalid />);

        expect(
            screen.getAllByRole('heading', { name: 'Join a game' }).length,
        ).toBeGreaterThan(0);
        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(document.querySelector('#name')).toBeNull();
        expect(headTitles).toEqual(['Join a game']);
    });
    it('offers the colours left free, the suggested one first, and posts the colour', () => {
        renderWithProviders(
            <JoinGameRoom
                isInvalid={false}
                guestToken="abc"
                session={session}
                suggestedName="Happy Otter"
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
            '/play/abc',
            { name: 'Happy Otter', presence: 7 },
            expect.anything(),
        );
    });
});
