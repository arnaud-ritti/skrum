import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import JoinWhiteboard from './join';

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

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const session = {
    title: 'Sprint board',
    facilitatorName: 'Fran Facilitator',
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

describe('whiteboards/join', () => {
    it('shows the board, who facilitates it and how many people are on it', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                session={session}
                suggestedName="Thoughtful otter"
            />,
        );

        const card = document.querySelector('[data-slot="guest-join-session"]');

        expect(card?.getAttribute('data-kind')).toBe('whiteboard');
        expect(card?.getAttribute('data-status')).toBe('live');
        expect(card?.textContent).toContain('Sprint board');
        expect(card?.textContent).toContain('3 participants');
        expect(card?.textContent).toContain('Fran Facilitator facilitates');
        expect(headTitles).toContain('Sprint board');
    });

    it('opens with the random nickname the server proposes and offers to draw another one', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                session={session}
                suggestedName="Thoughtful otter"
            />,
        );

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Thoughtful otter',
        );
        expect(
            document.querySelector('[data-slot="guest-join-preview"]')
                ?.textContent,
        ).toContain('Thoughtful otter');
        expect(
            screen.getByRole('button', { name: 'Another random nickname' }),
        ).toBeTruthy();
    });

    it('prefills the name of a signed-in visitor and posts it to the join route of the board', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                session={session}
                suggestedName="Oscar Outsider"
            />,
        );

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Oscar Outsider',
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/whiteboards/join/token-abc',
            { name: 'Oscar Outsider' },
            expect.anything(),
        );
    });

    it('shows the validation error of the name', () => {
        page.props = {
            ...page.props,
            errors: { name: 'The name field is required.' },
        };

        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                session={session}
                suggestedName="Thoughtful otter"
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'The name field is required.',
        );
    });

    it('shows the notice and no form when the guest link is no longer valid', () => {
        renderWithProviders(<JoinWhiteboard isInvalid />);

        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(screen.getAllByText('Join a whiteboard').length).toBeGreaterThan(
            0,
        );
        expect(document.querySelector('#name')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Join the session' }),
        ).toBeNull();
        expect(headTitles).toContain('Join a whiteboard');
        expect(post).not.toHaveBeenCalled();
    });
    it('offers the colours left free, the suggested one first, and posts the colour', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                session={session}
                suggestedName="Thoughtful otter"
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
            '/whiteboards/join/token-abc',
            { name: 'Thoughtful otter', presence: 7 },
            expect.anything(),
        );
    });
});
