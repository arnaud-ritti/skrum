import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { surveySessionForm } from '@/components/teams/session-create/survey-session-fields';
import type { SurveySessionFormProps } from '@/components/teams/session-create/survey-session-fields';
import { Button } from '@/components/ui/button';
import type {
    SurveyTemplateOption,
    TeamSurveySummary,
} from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { post: mocks.post },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const templates: SurveyTemplateOption[] = [
    {
        key: null,
        name: 'Blank',
        description: 'Start with no question.',
        questionCount: 0,
    },
    {
        key: 'health_check',
        name: 'Health check',
        description: "The team's statements, scored 1 to 5.",
        questionCount: 6,
    },
    {
        key: 'team_pulse',
        name: 'Team pulse',
        description: 'Workload, recommendation, rituals and blockers.',
        questionCount: 5,
    },
];

const enps: SurveyTemplateOption = {
    key: 'enps',
    name: 'eNPS',
    description:
        'Would people recommend the team and the company? Two scores from 0 to 10.',
    questionCount: 3,
};

function survey(
    id: string,
    title: string,
    status: TeamSurveySummary['status'],
): TeamSurveySummary {
    return {
        id,
        title,
        status,
        template: null,
        questionCount: 3,
        responseCount: 2,
        updatedAt: null,
        closedAt: null,
        facilitatorName: 'Ada',
        canManage: true,
        url: `/surveys/${id}`,
    };
}

const surveys: TeamSurveySummary[] = [
    survey('s-draft', 'Unfinished draft', 'draft'),
    survey('s-open', 'Sprint 41 pulse', 'open'),
    survey('s-closed', 'Onboarding feedback', 'closed'),
];

const team = { id: 't1', name: 'Atlas' };

function open(
    props: Partial<SurveySessionFormProps> = {},
    intent: Parameters<typeof NewSessionDialog>[0]['intent'] = null,
) {
    renderWithProviders(
        <NewSessionDialog
            trigger={<Button>New session</Button>}
            team={team}
            intent={intent}
            survey={surveySessionForm({
                workspaceSlug: 'acme',
                templates,
                surveys,
                ...props,
            })}
        />,
    );

    if (intent === null) {
        fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    }

    return screen.getByRole('dialog');
}

function startFrom(): HTMLElement {
    return screen.getByRole('radiogroup', { name: 'Start from' });
}

function checkedChoice(): string | undefined {
    return within(startFrom())
        .getAllByRole('radio')
        .find((radio) => radio.getAttribute('aria-checked') === 'true')
        ?.textContent?.trim();
}

function nameInput(): HTMLInputElement {
    return screen.getByLabelText('Name') as HTMLInputElement;
}

function typeName(value: string): void {
    fireEvent.change(nameInput(), { target: { value } });
}

function submit(dialog: HTMLElement): void {
    const button = within(dialog).getByRole('button', {
        name: 'Create & open',
    }) as HTMLButtonElement;

    fireEvent.submit(button.form as HTMLFormElement);
}

function lastPost(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.post.mock.calls[mocks.post.mock.calls.length - 1] as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

function today(): string {
    return new Date().toLocaleDateString('en', {
        day: 'numeric',
        month: 'short',
    });
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
});

describe('the survey form', () => {
    it('starts blank and posts the name and the guests off, without a template', () => {
        const dialog = open();

        expect(nameInput()).toBe(document.querySelector('#new-survey-title'));
        expect(nameInput().maxLength).toBe(120);
        expect(within(startFrom()).getAllByRole('radio')).toHaveLength(4);
        expect(
            screen
                .getByRole('radio', { name: 'Blank' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(document.querySelector('#new-survey-source')).toBeNull();

        typeName('Friday vote');
        submit(dialog);

        const [url, body] = lastPost();

        expect(url).toBe('/w/acme/teams/t1/surveys');
        expect(body).toEqual({
            title: 'Friday vote',
            guest_access_enabled: false,
        });
    });

    it('sends the health check template and counts its statements', () => {
        const dialog = open();
        const healthCheck = screen.getByRole('radio', { name: 'Health check' });

        expect(healthCheck.textContent).toContain(
            '6 statements · scored 1 to 5',
        );
        expect(healthCheck.textContent).toContain('Built-in');
        expect(
            screen.getByRole('radio', { name: 'Team pulse' }).textContent,
        ).toContain('5 questions');

        fireEvent.click(healthCheck);
        fireEvent.click(
            screen.getByLabelText('Allow guests without an account'),
        );
        submit(dialog);

        expect(lastPost()[1]).toEqual({
            title: `Health check ${today()}`,
            template: 'health_check',
            guest_access_enabled: true,
        });
    });

    it('reveals the surveys that are not drafts and sends the one chosen, without a template', async () => {
        const user = userEvent.setup();
        const dialog = open();

        fireEvent.click(screen.getByRole('radio', { name: 'Team pulse' }));
        fireEvent.click(
            screen.getByRole('radio', { name: 'A previous survey' }),
        );

        const source = document.querySelector('#new-survey-source');

        expect(source).not.toBeNull();
        expect(source?.textContent).toBe('Sprint 41 pulse');

        await user.click(source as HTMLElement);

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Sprint 41 pulse', 'Onboarding feedback']);

        await user.click(
            screen.getByRole('option', { name: 'Onboarding feedback' }),
        );
        typeName('Onboarding, again');
        submit(dialog);

        const body = lastPost()[1];

        expect(body.source_survey_id).toBe('s-closed');
        expect(body.title).toBe('Onboarding, again');
        expect(body).not.toHaveProperty('template');
    });

    it('disables "A previous survey" with its reason when every survey is a draft', () => {
        open({ surveys: [survey('s-draft', 'Unfinished draft', 'draft')] });

        const previous = screen.getByRole('radio', {
            name: 'A previous survey',
        });

        expect(previous.getAttribute('aria-disabled')).toBe('true');
        expect(previous.textContent).toContain('No survey to start from yet');

        fireEvent.click(previous);

        expect(checkedChoice()).toContain('Blank');
        expect(document.querySelector('#new-survey-source')).toBeNull();
    });

    it("prefills the name with the chosen template and today's date, until the user types", () => {
        open();

        expect(nameInput().value).toBe(`Survey ${today()}`);

        fireEvent.click(
            screen.getByRole('radio', { name: 'A previous survey' }),
        );

        expect(nameInput().value).toBe('Copy of Sprint 41 pulse');

        fireEvent.click(screen.getByRole('radio', { name: 'Team pulse' }));

        expect(nameInput().value).toBe(`Team pulse ${today()}`);

        typeName('Our pulse');
        fireEvent.click(screen.getByRole('radio', { name: 'Health check' }));

        expect(nameInput().value).toBe('Our pulse');
    });

    it('preselects the template named by the intent', () => {
        open({}, { type: 'survey', template: 'health_check' });

        expect(checkedChoice()).toContain('Health check');
        expect(nameInput().value).toBe(`Health check ${today()}`);
    });

    it("shows a template's whole name in its tile", () => {
        open({ templates: [...templates, enps] }, { type: 'survey' });

        const name = within(
            screen.getByRole('radio', { name: 'eNPS' }),
        ).getByText('eNPS');

        expect(name.className).toContain('break-words');
        expect(name.className).not.toMatch(/truncate|line-clamp/);
    });

    it('offers eNPS in the template picker with its three questions', () => {
        const dialog = open(
            { templates: [...templates, enps] },
            { type: 'survey', template: 'enps' },
        );
        const choice = screen.getByRole('radio', { name: 'eNPS' });

        expect(within(startFrom()).getAllByRole('radio')).toHaveLength(5);
        expect(choice.textContent).toBe('eNPS3 questions');
        expect(choice.getAttribute('aria-checked')).toBe('true');
        expect(nameInput().value).toBe(`eNPS ${today()}`);

        submit(dialog);

        expect(lastPost()[1]).toEqual({
            title: `eNPS ${today()}`,
            template: 'enps',
            guest_access_enabled: false,
        });
    });

    it('shows a refused name under the field', () => {
        const dialog = open();

        submit(dialog);
        act(() => lastPost()[2].onError?.({ title: 'The title is too long.' }));

        expect(screen.getByRole('alert').textContent).toBe(
            'The title is too long.',
        );
        expect(nameInput().getAttribute('aria-invalid')).toBe('true');
        expect(nameInput().getAttribute('aria-describedby')).toBe(
            'new-survey-title-error',
        );
    });

    it('counts one statement and one question in the singular', () => {
        open({
            templates: templates.map((template) => ({
                ...template,
                questionCount: 1,
            })),
        });

        expect(
            screen.getByRole('radio', { name: 'Health check' }).textContent,
        ).toContain('1 statement · scored 1 to 5');
        expect(
            screen.getByRole('radio', { name: 'Team pulse' }).textContent,
        ).toContain('1 question');
    });

    it('ties the refused template, survey and guests to their controls', () => {
        const dialog = open();

        submit(dialog);
        act(() =>
            lastPost()[2].onError?.({
                template: 'The selected template is invalid.',
                guest_access_enabled: 'Guests are not allowed here.',
            }),
        );

        expect(startFrom().getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(
                startFrom().getAttribute('aria-describedby')!,
            )?.textContent,
        ).toBe('The selected template is invalid.');
        expect(screen.getByText('Guests are not allowed here.').id).toBe(
            'new-survey-guests-error',
        );

        fireEvent.click(
            screen.getByRole('radio', { name: 'A previous survey' }),
        );
        submit(dialog);
        act(() =>
            lastPost()[2].onError?.({
                source_survey_id: 'The selected survey is invalid.',
            }),
        );

        expect(
            document
                .querySelector('#new-survey-source')
                ?.getAttribute('aria-describedby'),
        ).toBe('new-survey-source-error');
    });

    it('falls back on the first survey when the chosen one is gone', async () => {
        const user = userEvent.setup();
        const dialog = (list: TeamSurveySummary[]) => (
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                intent={null}
                survey={surveySessionForm({
                    workspaceSlug: 'acme',
                    templates,
                    surveys: list,
                })}
            />
        );
        const view = renderWithProviders(dialog(surveys));

        fireEvent.click(screen.getByRole('button', { name: 'New session' }));
        fireEvent.click(
            screen.getByRole('radio', { name: 'A previous survey' }),
        );
        await user.click(document.querySelector('#new-survey-source')!);
        await user.click(
            screen.getByRole('option', { name: 'Onboarding feedback' }),
        );

        view.rerender(dialog(surveys.slice(0, 2)));
        submit(screen.getByRole('dialog'));

        expect(lastPost()[1].source_survey_id).toBe('s-open');
    });
});
