import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import JoinPokerGame from './join';

const post = vi.hoisted(() => vi.fn());
const headTitles = vi.hoisted(() => [] as string[]);

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
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
        },
    }),
    router: { post },
    Head: ({ title }: { title: string }) => {
        headTitles.push(title);

        return null;
    },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const valid = {
    isInvalid: false as const,
    guestToken: 'abc',
    session: {
        title: 'Sprint 12 estimates',
        facilitatorName: 'Ada',
        participantsCount: 3,
        isLive: true,
    },
    suggestedName: 'Visitor',
};

beforeEach(() => {
    post.mockClear();
    headTitles.length = 0;
});

describe('poker join page', () => {
    it('names the document after the game, or after the page when the link is dead', () => {
        const { unmount } = renderWithProviders(<JoinPokerGame {...valid} />);

        expect(headTitles).toContain('Sprint 12 estimates');

        unmount();
        headTitles.length = 0;
        renderWithProviders(<JoinPokerGame isInvalid />);

        expect(headTitles).toContain('Join a planning poker game');
    });

    it('shows the game with its facilitator, its players and its state', () => {
        renderWithProviders(<JoinPokerGame {...valid} />);

        const card = document.querySelector('[data-slot="guest-join-session"]');

        expect(card?.getAttribute('data-kind')).toBe('poker');
        expect(card?.textContent).toContain('Sprint 12 estimates');
        expect(screen.getByText('Ada facilitates')).toBeTruthy();
        expect(screen.getByText('3 participants')).toBeTruthy();
        expect(screen.getByText('Live')).toBeTruthy();
        expect(screen.getByLabelText('Your nickname')).toBeTruthy();
    });

    it('offers "Join as spectator" as a switch that is off', () => {
        renderWithProviders(<JoinPokerGame {...valid} />);

        const control = screen.getByRole('switch', {
            name: 'Join as spectator',
        });

        expect(control.id).toBe('spectator');
        expect(control.getAttribute('aria-checked')).toBe('false');
    });

    it('joins as a player when the switch is left off', () => {
        renderWithProviders(<JoinPokerGame {...valid} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/poker/join/abc',
            { name: 'Visitor' },
            expect.anything(),
        );
    });

    it('posts spectator=1 when the switch is on', () => {
        renderWithProviders(<JoinPokerGame {...valid} />);

        fireEvent.click(screen.getByRole('switch'));
        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/poker/join/abc',
            { name: 'Visitor', spectator: '1' },
            expect.anything(),
        );
    });

    it('shows the notice of an invalid link, without a form', () => {
        renderWithProviders(<JoinPokerGame isInvalid />);

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Join a planning poker game',
        );
        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(document.querySelector('#name')).toBeNull();
    });
    it('offers the colours left free, the suggested one first, and posts the colour', () => {
        renderWithProviders(
            <JoinPokerGame
                {...valid}
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
            '/poker/join/abc',
            { name: 'Visitor', presence: 7 },
            expect.anything(),
        );
    });
});
