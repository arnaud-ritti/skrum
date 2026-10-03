import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import JoinSurvey from './join';

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
    title: 'Team pulse',
    facilitatorName: 'Fran Facilitator',
    participantsCount: 4,
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

function renderJoin(overrides: Partial<typeof session> = {}) {
    return renderWithProviders(
        <JoinSurvey
            isInvalid={false}
            guestToken="token-abc"
            surveyTitle="Team pulse"
            session={{ ...session, ...overrides }}
            suggestedName="Thoughtful otter"
        />,
    );
}

function summaryCard(): Element | null {
    return document.querySelector('[data-slot="guest-join-session"]');
}

describe('surveys/join', () => {
    it('shows the survey, who runs it and how many people are in it', () => {
        renderJoin();

        const card = summaryCard();

        expect(card?.getAttribute('data-kind')).toBe('survey');
        expect(card?.textContent).toContain('Team pulse');
        expect(card?.textContent).toContain('4 participants');
        expect(card?.textContent).toContain('Fran Facilitator facilitates');
        expect(headTitles).toContain('Team pulse');
    });

    it('says "Live" only while the survey is open', () => {
        const { unmount } = renderJoin();

        expect(summaryCard()?.getAttribute('data-status')).toBe('live');
        expect(summaryCard()?.textContent).toContain('Live');

        unmount();
        renderJoin({ isLive: false });

        expect(summaryCard()?.getAttribute('data-status')).not.toBe('live');
        expect(summaryCard()?.textContent).not.toContain('Live');
    });

    it('opens with the suggested nickname and posts it to the join route of the survey', () => {
        renderJoin();

        expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe(
            'Thoughtful otter',
        );
        expect(
            screen.getByRole('button', { name: 'Another random nickname' }),
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Join the session' }),
        );

        expect(post).toHaveBeenCalledWith(
            '/surveys/join/token-abc',
            { name: 'Thoughtful otter' },
            expect.anything(),
        );
    });

    it('shows the notice and no form when the guest link is no longer valid', () => {
        renderWithProviders(<JoinSurvey isInvalid />);

        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(screen.getAllByText('Join a survey').length).toBeGreaterThan(0);
        expect(document.querySelector('#name')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Join the session' }),
        ).toBeNull();
        expect(headTitles).toContain('Join a survey');
        expect(post).not.toHaveBeenCalled();
    });
});
