import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyBuilder } from '@/components/surveys/survey-builder';
import { RetroRequestError } from '@/lib/retro/api';
import type {
    SurveyKind,
    SurveyQuestionPayload,
    SurveySnapshot,
} from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

const api = vi.hoisted(() => ({
    snapshot: vi.fn(),
    update: vi.fn(),
    addQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    removeQuestion: vi.fn(),
    reorderQuestions: vi.fn(),
    duplicateQuestion: vi.fn(),
    setStatus: vi.fn(),
}));

const viewport = vi.hoisted(() => ({ isWide: true }));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/surveys/api', () => ({ surveyApi: api }));

vi.mock('sonner', () => ({ toast }));

vi.mock('@/hooks/use-min-width', () => ({
    useMinWidth: () => viewport.isWide,
}));

vi.mock('@/hooks/use-survey-channel', () => ({
    useSurveyChannel: () => ({
        online: [{ id: 'me' }],
        connected: true,
        reconnecting: false,
    }),
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        breadcrumbs,
        status,
        actions,
        children,
    }: {
        breadcrumbs: { title: string; href: string }[];
        status?: ReactNode;
        actions: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <nav aria-label="Breadcrumb">
                {breadcrumbs.map((crumb) => (
                    <a key={crumb.title} href={crumb.href}>
                        {crumb.title}
                    </a>
                ))}
                <span data-test="breadcrumb-status">{status}</span>
            </nav>
            <header>{actions}</header>
            {children}
        </div>
    ),
}));

function question(
    id: string,
    kind: SurveyKind,
    label: string,
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    return {
        id,
        kind,
        label,
        shortLabel: null,
        description: null,
        position: 0,
        isRequired: false,
        allowsComment: kind === 'scale' || kind === 'nps',
        scaleMax: kind === 'scale' ? 5 : null,
        scaleLabels:
            kind === 'scale' ? ['Unbearable', 'Very comfortable'] : null,
        isBuiltin: false,
        options:
            kind === 'single' || kind === 'multiple'
                ? [
                      { id: `${id}-o1`, label: 'Daily' },
                      { id: `${id}-o2`, label: 'Review' },
                  ]
                : [],
        myAnswer: null,
        ...overrides,
    };
}

const pulse = [
    question('q1', 'scale', 'How do you rate the workload?', {
        isRequired: true,
    }),
    question('q2', 'nps', 'Would you recommend this team?', {
        isRequired: true,
    }),
    question('q3', 'single', 'Which ritual should we keep?'),
    question('q4', 'multiple', 'What slowed you down?'),
    question('q5', 'text', 'A word for the team?'),
].map((item, position) => ({ ...item, position }));

function snapshot(
    overrides: {
        survey?: Partial<SurveySnapshot['survey']>;
        questions?: SurveyQuestionPayload[];
        progress?: Partial<SurveySnapshot['progress']>;
        links?: Partial<SurveySnapshot['links']>;
    } = {},
): SurveySnapshot {
    return {
        survey: {
            id: 's-1',
            title: 'Team pulse — sprint 42',
            description: null,
            status: 'draft',
            template: null,
            hasLockedQuestions: false,
            teamId: 'team-1',
            teamName: 'Atlas',
            retroId: null,
            facilitatorName: 'Arnaud',
            guestAccessEnabled: false,
            guestUrl: null,
            joinCode: null,
            oneQuestionAtATime: true,
            showResultsAfterAnswer: true,
            resultsThreshold: 3,
            version: 4,
            openedAt: null,
            closedAt: null,
            savedAt: '2026-10-03T07:59:56Z',
            ...overrides.survey,
        },
        me: {
            id: 'me',
            name: 'Arnaud',
            avatarUrl: '',
            isGuest: false,
            isEditor: true,
            hasSubmitted: false,
            canSeeResults: true,
        },
        questions: overrides.questions ?? pulse,
        progress: {
            responses: 0,
            completed: 0,
            audience: 11,
            ...overrides.progress,
        },
        results: null,
        comparable: null,
        links: {
            team: '/w/nordlys/teams/team-1',
            show: '/surveys/s-1',
            results: '/surveys/s-1/results',
            edit: '/surveys/s-1/edit',
            healthCheck: null,
            ...overrides.links,
        },
        serverTime: '2026-10-03T08:00:00Z',
    };
}

function card(number: number): HTMLElement {
    return screen.getByRole('region', { name: `Question ${number}` });
}

function button(name: string): HTMLButtonElement {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function saveStatus(): string {
    return (
        screen
            .getAllByRole('status')
            .find((status) => status.hasAttribute('data-save-state'))
            ?.textContent ?? ''
    );
}

beforeEach(() => {
    viewport.isWide = true;

    for (const fn of Object.values(api)) {
        fn.mockReset();
    }

    toast.error.mockReset();
    api.snapshot.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SurveyBuilder', () => {
    it('shows an empty draft with the add bar and an empty state', () => {
        renderWithProviders(
            <SurveyBuilder snapshot={snapshot({ questions: [] })} />,
        );

        expect(screen.getByText('No question yet')).toBeTruthy();
        expect(screen.getByText('0 questions')).toBeTruthy();
        expect(
            screen.getByRole('group', { name: 'Add a question' }),
        ).toBeTruthy();
        expect(button('Publish').disabled).toBe(true);
        expect(
            document.querySelector('[data-test="breadcrumb-status"]')
                ?.textContent,
        ).toBe('Draft');
    });

    it('says when the survey was last saved before anything is saved on this visit', () => {
        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        expect(saveStatus()).toBe('Saved 4 sec ago');
    });

    it('shows five questions with the first open, as in the mockup', () => {
        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        expect(screen.getByText('5 questions')).toBeTruthy();
        expect(card(1).getAttribute('data-open')).toBe('true');
        expect(card(2).getAttribute('data-open')).toBeNull();
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
        expect(
            (document.getElementById('survey-title') as HTMLInputElement).value,
        ).toBe('Team pulse — sprint 42');
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Team pulse — sprint 42',
            }),
        ).toBeTruthy();
        expect(within(card(2)).getByText('NPS 0 – 10')).toBeTruthy();
        expect(
            screen.getByText(
                'A result is shown from 3 answers, and free answers are sorted before they are shown.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('Answers are anonymous')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Surveys' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1#surveys');
        expect(
            document
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connected');
    });

    it('opens a choice question and closes the one open before', () => {
        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        fireEvent.click(
            within(card(3)).getByRole('button', {
                name: 'Which ritual should we keep?',
            }),
        );

        expect(card(1).getAttribute('data-open')).toBeNull();
        expect(card(3).getAttribute('data-open')).toBe('true');
        expect(
            within(card(3)).getAllByRole('textbox', { name: /^Option/ }),
        ).toHaveLength(2);
    });

    it('saves two quick edits of one question in one request, then says saved', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockImplementation(
            async (_id, questionId, body) => ({
                question: { ...pulse[0], id: questionId, label: body.label },
            }),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        const label = document.getElementById('question-label-q1')!;

        fireEvent.change(label, { target: { value: 'Workload' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        fireEvent.change(label, { target: { value: 'Workload?' } });

        expect(api.updateQuestion).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(api.updateQuestion).toHaveBeenCalledTimes(1);
        expect(api.updateQuestion).toHaveBeenCalledWith(
            's-1',
            'q1',
            expect.objectContaining({ kind: 'scale', label: 'Workload?' }),
        );
        expect(saveStatus()).toMatch(/^Saved .* ago$/);
    });

    it('says saving while the request runs', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockImplementation(() => new Promise(() => {}));

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(saveStatus()).toBe('Saving…');
    });

    it('shows a failed save on its field and says not saved', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockRejectedValue(
            new RetroRequestError(
                422,
                'The label may not be greater than 200 characters.',
            ),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(saveStatus()).toBe('Not saved');
        expect(within(card(1)).getByRole('alert').textContent).toBe(
            'The label may not be greater than 200 characters.',
        );
    });

    it('says not saved while a question has no label, without sending it', async () => {
        vi.useFakeTimers();

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: '  ' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(api.updateQuestion).not.toHaveBeenCalled();
        expect(saveStatus()).toBe('Not saved');
    });

    it('adds a choice question, opens it and focuses its label', async () => {
        const added = question('q6', 'single', 'Untitled question', {
            position: 5,
            options: [
                { id: 'o-a', label: 'Option 1' },
                { id: 'o-b', label: 'Option 2' },
            ],
        });

        api.addQuestion.mockResolvedValue({ question: added });

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.click(button('Single choice'));

        await waitFor(() =>
            expect(card(6).getAttribute('data-open')).toBe('true'),
        );

        expect(api.addQuestion).toHaveBeenCalledWith('s-1', {
            kind: 'single',
            label: 'Untitled question',
            is_required: false,
            options: ['Option 1', 'Option 2'],
        });
        expect(document.activeElement).toBe(
            document.getElementById('question-label-q6'),
        );
        expect(card(1).getAttribute('data-open')).toBeNull();
    });

    it('deletes an untitled question without asking', async () => {
        api.removeQuestion.mockResolvedValue(null);

        renderWithProviders(
            <SurveyBuilder
                snapshot={snapshot({
                    questions: [question('q9', 'text', 'Untitled question')],
                })}
            />,
        );
        fireEvent.click(button('Delete'));

        await waitFor(() => expect(screen.queryByRole('region')).toBeNull());

        expect(api.removeQuestion).toHaveBeenCalledWith('s-1', 'q9');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('asks before deleting a question with a typed label', async () => {
        api.removeQuestion.mockResolvedValue(null);

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.click(button('Delete'));

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete this question?',
        });

        expect(api.removeQuestion).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(api.removeQuestion).toHaveBeenCalledWith('s-1', 'q1'),
        );
        await waitFor(() =>
            expect(screen.getAllByRole('region')).toHaveLength(4),
        );
    });

    it('duplicates the open question after its pending save', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockImplementation(
            async (_id, questionId, body) => ({
                question: { ...pulse[0], id: questionId, label: body.label },
            }),
        );
        api.duplicateQuestion.mockResolvedValue({
            question: {
                ...pulse[0],
                id: 'q1-copy',
                position: 1,
                label: 'Workload',
            },
        });

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        fireEvent.click(button('Duplicate'));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(api.updateQuestion).toHaveBeenCalledTimes(1);
        expect(api.duplicateQuestion).toHaveBeenCalledWith('s-1', 'q1');
        expect(card(2).getAttribute('data-open')).toBe('true');
        expect(screen.getAllByRole('region')).toHaveLength(6);
    });

    it('reorders with the keyboard and saves the new order', async () => {
        api.reorderQuestions.mockResolvedValue(null);

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        const handle = button('Reorder question 1');

        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        fireEvent.keyDown(handle, { key: ' ' });

        expect(api.reorderQuestions).toHaveBeenCalledWith('s-1', [
            'q2',
            'q1',
            'q3',
            'q4',
            'q5',
        ]);
        expect(
            within(card(1)).getByText('Would you recommend this team?'),
        ).toBeTruthy();
    });

    it('brings the server order back with a toast when the order is refused', async () => {
        api.reorderQuestions.mockRejectedValue(
            new RetroRequestError(422, 'Send every question exactly once.'),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        const handle = button('Reorder question 1');

        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        fireEvent.keyDown(handle, { key: ' ' });

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'The order could not be saved.',
            ),
        );

        expect(
            (document.getElementById('question-label-q1') as HTMLInputElement)
                .closest('section')
                ?.getAttribute('aria-label'),
        ).toBe('Question 1');
    });

    it('publishes after the pending saves', async () => {
        vi.useFakeTimers();

        const calls: string[] = [];

        api.updateQuestion.mockImplementation(async (_id, questionId, body) => {
            calls.push('save');

            return {
                question: { ...pulse[0], id: questionId, label: body.label },
            };
        });
        api.setStatus.mockImplementation(async () => {
            calls.push('publish');

            return null;
        });

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        fireEvent.click(button('Publish'));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(calls).toEqual(['save', 'publish']);
        expect(api.setStatus).toHaveBeenCalledWith('s-1', 'open');
        expect(api.snapshot).toHaveBeenCalledWith('s-1');
    });

    it('shows the server message when publishing is refused', async () => {
        api.setStatus.mockRejectedValue(
            new RetroRequestError(422, 'Add a question before publishing.'),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.click(button('Publish'));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'Add a question before publishing.',
            ),
        );
    });

    it('locks the questions of a health check under a link to the statements', () => {
        renderWithProviders(
            <SurveyBuilder
                snapshot={snapshot({
                    survey: {
                        template: 'health_check',
                        hasLockedQuestions: true,
                        resultsThreshold: 0,
                    },
                    links: {
                        healthCheck: '/w/nordlys/teams/team-1/health-check',
                    },
                    questions: [
                        question('h1', 'scale', 'We deliver value', {
                            isBuiltin: true,
                            scaleLabels: [
                                'Strongly disagree',
                                'Strongly agree',
                            ],
                        }),
                        question('h2', 'scale', 'We have fun', {
                            isBuiltin: true,
                            scaleLabels: [
                                'Strongly disagree',
                                'Strongly agree',
                            ],
                        }),
                    ],
                })}
            />,
        );

        expect(
            screen.getByText(
                "The questions of a health check come from the team's statements.",
            ),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Manage statements' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/health-check');
        expect(
            screen.queryByRole('group', { name: 'Add a question' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
        expect(screen.getAllByText('Strongly disagree')).toHaveLength(2);
        expect(
            screen.getByText('Free answers are sorted before they are shown.'),
        ).toBeTruthy();
        expect(
            (document.getElementById('survey-title') as HTMLInputElement)
                .disabled,
        ).toBe(false);
    });

    it('shows the questions of an open survey read only and keeps the settings', async () => {
        api.update.mockResolvedValue(
            snapshot({
                survey: {
                    status: 'open',
                    version: 5,
                    guestAccessEnabled: true,
                },
            }),
        );
        api.setStatus.mockResolvedValue(null);

        renderWithProviders(
            <SurveyBuilder
                snapshot={snapshot({ survey: { status: 'open' } })}
            />,
        );

        expect(
            screen.getByText('Questions cannot change once a survey is open.'),
        ).toBeTruthy();
        expect(
            screen.queryByRole('group', { name: 'Add a question' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull();
        expect(screen.queryByRole('textbox', { name: 'Label' })).toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'View results' })
                .getAttribute('href'),
        ).toBe('/surveys/s-1/results');

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }),
        );

        expect(
            screen
                .getByRole('switch', {
                    name: 'Allow guests without an account',
                })
                .getAttribute('aria-checked'),
        ).toBe('true');

        await waitFor(() =>
            expect(api.update).toHaveBeenCalledWith('s-1', {
                guest_access_enabled: true,
            }),
        );

        fireEvent.click(button('Back to draft'));

        await waitFor(() =>
            expect(api.setStatus).toHaveBeenCalledWith('s-1', 'draft'),
        );
    });

    it('shows a closed survey with its results and no way back to draft', () => {
        renderWithProviders(
            <SurveyBuilder
                snapshot={snapshot({
                    survey: { status: 'closed' },
                    progress: { responses: 9, completed: 9 },
                })}
            />,
        );

        expect(
            document.querySelector('[data-test="breadcrumb-status"]')
                ?.textContent,
        ).toBe('Closed');
        expect(screen.getByRole('link', { name: 'View results' })).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Back to draft' }),
        ).toBeNull();
        expect(
            screen.getByText('Questions cannot change once a survey is open.'),
        ).toBeTruthy();
    });

    it('puts the settings in a sheet below lg', () => {
        viewport.isWide = false;

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        expect(
            screen.queryByRole('switch', { name: 'One question at a time' }),
        ).toBeNull();

        fireEvent.click(button('Survey builder settings'));

        const sheet = screen.getByRole('dialog', {
            name: 'Survey builder settings',
        });

        expect(
            within(sheet).getByRole('switch', {
                name: 'One question at a time',
            }),
        ).toBeTruthy();
    });

    it('saves the title after the typing stops', async () => {
        vi.useFakeTimers();
        api.update.mockResolvedValue(
            snapshot({ survey: { title: 'Pulse', version: 5 } }),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('survey-title')!, {
            target: { value: 'Pulse' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(api.update).toHaveBeenCalledWith('s-1', { title: 'Pulse' });
    });

    it('keeps Preview disabled until a participant view is given, then opens it', () => {
        const { unmount } = renderWithProviders(
            <SurveyBuilder snapshot={snapshot()} />,
        );

        expect(button('Preview').disabled).toBe(true);

        unmount();

        renderWithProviders(
            <SurveyBuilder
                snapshot={snapshot()}
                preview={(current) => (
                    <p>{`Participant view of ${current.questions.length}`}</p>
                )}
            />,
        );
        fireEvent.click(button('Preview'));

        expect(
            screen.getByRole('dialog', { name: 'Preview' }).textContent,
        ).toContain('Participant view of 5');
    });

    it('warns before leaving while a save is pending', () => {
        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        const quiet = new Event('beforeunload', { cancelable: true });

        window.dispatchEvent(quiet);

        expect(quiet.defaultPrevented).toBe(false);

        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });

        const leaving = new Event('beforeunload', { cancelable: true });

        window.dispatchEvent(leaving);

        expect(leaving.defaultPrevented).toBe(true);
    });
    it('sends a pending edit when the builder leaves the page within the delay', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockImplementation(() => new Promise(() => {}));

        const { unmount } = renderWithProviders(
            <SurveyBuilder snapshot={snapshot()} />,
        );

        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        unmount();

        expect(api.updateQuestion).toHaveBeenCalledWith(
            's-1',
            'q1',
            expect.objectContaining({ label: 'Workload' }),
        );
    });

    it('keeps saying not saved while a failed question is unsaved, after a setting saves', async () => {
        vi.useFakeTimers();
        api.updateQuestion.mockRejectedValue(
            new RetroRequestError(422, 'The label is invalid.'),
        );
        api.update.mockResolvedValue(
            snapshot({ survey: { guestAccessEnabled: true, version: 5 } }),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(api.update).toHaveBeenCalledTimes(1);
        expect(saveStatus()).toBe('Not saved');
        expect(button('Publish').disabled).toBe(true);

        const leaving = new Event('beforeunload', { cancelable: true });

        window.dispatchEvent(leaving);

        expect(leaving.defaultPrevented).toBe(true);
    });

    it('publishes only once a save already in flight has answered', async () => {
        vi.useFakeTimers();

        const calls: string[] = [];
        let answer: () => void = () => {};

        api.updateQuestion.mockImplementation(
            (_id, questionId, body) =>
                new Promise((resolve) => {
                    answer = () => {
                        calls.push('save');
                        resolve({
                            question: {
                                ...pulse[0],
                                id: questionId,
                                label: body.label,
                            },
                        });
                    };
                }),
        );
        api.setStatus.mockImplementation(async () => {
            calls.push('publish');

            return null;
        });

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        fireEvent.click(button('Publish'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(api.setStatus).not.toHaveBeenCalled();

        await act(async () => {
            answer();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(calls).toEqual(['save', 'publish']);
    });

    it('keeps Publish disabled while a question cannot be saved', () => {
        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: '  ' },
        });

        expect(button('Publish').disabled).toBe(true);
    });

    it('does not bring back a question deleted while its save was in flight', async () => {
        vi.useFakeTimers();

        let answer: () => void = () => {};

        api.updateQuestion.mockImplementation(
            (_id, questionId, body) =>
                new Promise((resolve) => {
                    answer = () =>
                        resolve({
                            question: {
                                ...pulse[0],
                                id: questionId,
                                label: body.label,
                            },
                        });
                }),
        );
        api.removeQuestion.mockResolvedValue(null);

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);
        fireEvent.change(document.getElementById('question-label-q1')!, {
            target: { value: 'Workload' },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        fireEvent.click(button('Delete'));
        fireEvent.click(
            within(
                screen.getByRole('alertdialog', {
                    name: 'Delete this question?',
                }),
            ).getByRole('button', { name: 'Delete' }),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(api.removeQuestion).not.toHaveBeenCalled();

        await act(async () => {
            answer();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(api.removeQuestion).toHaveBeenCalledWith('s-1', 'q1');
        expect(screen.getAllByRole('region')).toHaveLength(4);
        expect(screen.queryByDisplayValue('Workload')).toBeNull();
    });

    it('keeps the second of two quick settings while the first answers', async () => {
        vi.useFakeTimers();

        const answers: (() => void)[] = [];

        api.update.mockImplementation(
            (_id, patch) =>
                new Promise((resolve) => {
                    answers.push(() =>
                        resolve(
                            snapshot({
                                survey:
                                    'guest_access_enabled' in patch
                                        ? {
                                              guestAccessEnabled: true,
                                              version: 5,
                                          }
                                        : {
                                              guestAccessEnabled: true,
                                              oneQuestionAtATime: false,
                                              version: 6,
                                          },
                            }),
                        ),
                    );
                }),
        );

        renderWithProviders(<SurveyBuilder snapshot={snapshot()} />);

        const guests = (): HTMLElement =>
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            });
        const oneAtATime = (): HTMLElement =>
            screen.getByRole('switch', { name: 'One question at a time' });

        fireEvent.click(guests());
        fireEvent.click(oneAtATime());
        await act(async () => {
            answers[0]();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(guests().getAttribute('aria-checked')).toBe('true');
        expect(oneAtATime().getAttribute('aria-checked')).toBe('false');

        await act(async () => {
            answers[1]();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(guests().getAttribute('aria-checked')).toBe('true');
        expect(oneAtATime().getAttribute('aria-checked')).toBe('false');
    });
});
