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
                boardTitle="Sprint board"
                session={session}
                suggestedName={null}
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

    it('promises no suggested nickname to a visitor with an empty name: the board has none', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                boardTitle="Sprint board"
                session={session}
                suggestedName={null}
            />,
        );

        expect(
            screen.queryByText('Suggested nickname if you leave it empty'),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="guest-join-preview"]'),
        ).toBeNull();
    });

    it('prefills the name of a signed-in visitor and posts it to the join route of the board', () => {
        renderWithProviders(
            <JoinWhiteboard
                isInvalid={false}
                guestToken="token-abc"
                boardTitle="Sprint board"
                session={session}
                suggestedName="Oscar Outsider"
            />,
        );

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Oscar Outsider',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

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
                boardTitle="Sprint board"
                session={session}
                suggestedName={null}
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
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
        expect(headTitles).toContain('Join a whiteboard');
        expect(post).not.toHaveBeenCalled();
    });
});
