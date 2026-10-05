import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSurveysSection } from '@/components/teams/team-surveys-section';
import { RetroRequestError } from '@/lib/retro/api';
import type { TeamSurveySummary } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    reload: vi.fn(),
    request: vi.fn(),
    toastError: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            reload: mocks.reload,
            on: vi.fn(() => () => {}),
        },
    };
});

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.request,
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

const open: TeamSurveySummary = {
    id: 'survey-1',
    title: 'Team pulse — October',
    status: 'open',
    template: 'team_pulse',
    questionCount: 5,
    responseCount: 4,
    updatedAt: '2026-10-01T08:00:00+00:00',
    closedAt: null,
    facilitatorName: 'Camille Roux',
    canManage: true,
    url: '/surveys/survey-1/results',
};

const draft: TeamSurveySummary = {
    ...open,
    id: 'survey-2',
    title: 'Onboarding feedback',
    status: 'draft',
    template: null,
    questionCount: 1,
    responseCount: 0,
    url: '/surveys/survey-2/edit',
};

const closed: TeamSurveySummary = {
    ...open,
    id: 'survey-3',
    title: 'Health check — September',
    status: 'closed',
    template: 'health_check',
    responseCount: 1,
    closedAt: '2026-09-30T08:00:00+00:00',
    canManage: false,
    url: '/surveys/survey-3/results',
};

function renderSection(
    surveys: TeamSurveySummary[],
    canCreateSurvey = true,
): ReturnType<typeof renderWithProviders> {
    return renderWithProviders(
        <TeamSurveysSection
            workspaceSlug="nordlys"
            teamId="team-1"
            surveys={surveys}
            canCreateSurvey={canCreateSurvey}
        />,
    );
}

function cards(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-test="survey-card"]'),
    );
}

function cardOf(title: string): HTMLElement {
    const card = cards().find(
        (element) => within(element).queryByText(title) !== null,
    );

    if (card === undefined) {
        throw new Error(`No card for ${title}`);
    }

    return card;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TeamSurveysSection', () => {
    it('is the block "Surveys" with the anchor #surveys', () => {
        const { container } = renderSection([open]);

        expect(container.querySelector('section#surveys')).not.toBeNull();
        expect(
            screen.getByRole('heading', { level: 2, name: /^Surveys/ }),
        ).toBeTruthy();
    });

    it('shows one survey card per survey, with its title, status, counts and link', () => {
        renderSection([open, draft, closed]);

        expect(cards()).toHaveLength(3);

        const openCard = cardOf('Team pulse — October');

        expect(within(openCard).getByText('Open')).toBeTruthy();
        expect(
            within(openCard).getByText('4 answers · 5 questions'),
        ).toBeTruthy();
        expect(
            within(openCard)
                .getByRole('link', {
                    name: /Team pulse — October/,
                })
                .getAttribute('href'),
        ).toBe('/surveys/survey-1/results');
        expect(
            within(openCard)
                .getByRole('link', { name: /Team pulse — October/ })
                .getAttribute('data-kind'),
        ).toBe('survey');

        const draftCard = cardOf('Onboarding feedback');

        expect(within(draftCard).getByText('Draft')).toBeTruthy();
        expect(
            within(draftCard).getByText('0 answers · 1 question'),
        ).toBeTruthy();
        expect(within(draftCard).getByRole('link').getAttribute('href')).toBe(
            '/surveys/survey-2/edit',
        );

        const closedCard = cardOf('Health check — September');

        expect(within(closedCard).getByText('Closed')).toBeTruthy();
        expect(
            within(closedCard).getByText('1 answer · 5 questions'),
        ).toBeTruthy();
    });

    it('offers "Duplicate" to who may create, and "Delete" only on a survey the viewer manages', async () => {
        const user = userEvent.setup();

        renderSection([open, closed]);

        await user.click(
            within(cardOf('Team pulse — October')).getByRole('button', {
                name: 'Survey actions',
            }),
        );

        expect(
            screen.getByRole('menuitem', { name: 'Duplicate' }),
        ).toBeTruthy();
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();

        await user.keyboard('{Escape}');
        await user.click(
            within(cardOf('Health check — September')).getByRole('button', {
                name: 'Survey actions',
            }),
        );

        expect(
            screen.getByRole('menuitem', { name: 'Duplicate' }),
        ).toBeTruthy();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });

    it('duplicates through an Inertia post to the duplicate route', async () => {
        const user = userEvent.setup();

        renderSection([open]);

        await user.click(
            screen.getByRole('button', { name: 'Survey actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

        expect(mocks.post).toHaveBeenCalledWith(
            '/surveys/survey-1/duplicate',
            {},
            expect.objectContaining({ preserveScroll: true }),
        );
    });

    it('has no menu on a survey the viewer can neither duplicate nor delete', () => {
        renderSection([closed], false);

        expect(
            screen.queryByRole('button', { name: 'Survey actions' }),
        ).toBeNull();
    });

    it('asks before deleting, then deletes and reloads the surveys only', async () => {
        const user = userEvent.setup();

        mocks.request.mockResolvedValue(undefined);
        renderSection([open]);

        await user.click(
            screen.getByRole('button', { name: 'Survey actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Delete this survey?',
        });

        expect(
            within(dialog).getByText(
                'Its questions and answers are deleted too.',
            ),
        ).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete' }),
        );

        expect(mocks.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/surveys/survey-1',
                method: 'delete',
            }),
        );
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['surveys'] });
    });

    it('keeps the dialog open and says why when the deletion is refused', async () => {
        const user = userEvent.setup();

        mocks.request.mockRejectedValue(
            new RetroRequestError(403, 'This action is unauthorized.'),
        );
        renderSection([open]);

        await user.click(
            screen.getByRole('button', { name: 'Survey actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await user.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Delete',
            }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This action is unauthorized.',
        );
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('says the survey is already gone and reloads the list', async () => {
        const user = userEvent.setup();

        mocks.request.mockRejectedValue(
            new RetroRequestError(404, 'This survey no longer exists.'),
        );
        renderSection([open]);

        await user.click(
            screen.getByRole('button', { name: 'Survey actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await user.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Delete',
            }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This survey no longer exists.',
        );
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['surveys'] });
    });

    it('shows the survey empty state, whose action opens "New session" on the survey type', () => {
        renderSection([]);

        expect(cards()).toHaveLength(0);
        expect(
            screen.getByRole('heading', { name: 'No survey published' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Create a survey' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1?new=survey');
    });

    it('has no "Create a survey" action for who may not create one', () => {
        renderSection([], false);

        expect(
            screen.getByRole('heading', { name: 'No survey published' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('link', { name: 'Create a survey' }),
        ).toBeNull();
    });
});
