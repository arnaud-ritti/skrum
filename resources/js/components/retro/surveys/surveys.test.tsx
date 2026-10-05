import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardProvider } from '@/components/retro/board-context';
import { SurveyBoardCard } from '@/components/retro/surveys/survey-board-card';
import { SurveyResultList } from '@/components/retro/surveys/survey-result-list';
import { SurveysColumn } from '@/components/retro/surveys/surveys-column';
import type { SurveyPayload } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

function survey(overrides: Partial<SurveyPayload> = {}): SurveyPayload {
    return {
        id: 'survey-1',
        kind: 'single',
        question: 'How was the sprint?',
        description: null,
        position: 0,
        isClosed: false,
        version: 1,
        showVoters: false,
        responseCount: 0,
        myOptionIds: [],
        myText: null,
        resultsVisible: false,
        options: [
            {
                id: 'great',
                label: 'Great',
                position: 0,
                count: null,
                voters: null,
            },
            { id: 'ok', label: 'OK', position: 1, count: null, voters: null },
        ],
        textAnswers: null,
        reactions: [],
        commentCount: 0,
        comments: [],
        ...overrides,
    };
}

const answered = (overrides: Partial<SurveyPayload> = {}) =>
    survey({
        responseCount: 1,
        myOptionIds: ['great'],
        resultsVisible: true,
        options: [
            {
                id: 'great',
                label: 'Great',
                position: 0,
                count: 1,
                voters: null,
            },
            { id: 'ok', label: 'OK', position: 1, count: 0, voters: null },
        ],
        ...overrides,
    });

const card = () => screen.getByRole('article', { name: 'How was the sprint?' });

beforeEach(() => {
    retroRequest.mockReset();
});

describe('SurveysColumn', () => {
    it('is the "Surveys" region, with one card per survey named by its question', () => {
        renderInBoard(
            <SurveysColumn />,
            boardContext(
                retroSnapshot({
                    surveys: [
                        survey(),
                        survey({
                            id: 'survey-2',
                            question: 'And the next one?',
                        }),
                    ],
                }),
            ),
        );

        const region = screen.getByRole('region', { name: 'Surveys' });

        expect(within(region).getAllByRole('article')).toHaveLength(2);
        expect(
            document.querySelector('article[aria-label="And the next one?"]'),
        ).not.toBeNull();
        expect(
            within(region).getByRole('heading', { level: 2, name: 'Surveys' }),
        ).toBeTruthy();
    });

    it.each([
        ['without a survey', retroSnapshot()],
        [
            'outside the survey phases',
            retroSnapshot({ retro: { phase: 'actions' }, surveys: [survey()] }),
        ],
    ])('renders nothing %s', (_, board) => {
        const { container } = renderInBoard(
            <SurveysColumn />,
            boardContext(board),
        );

        expect(container.querySelector('section')).toBeNull();
    });
});

describe('SurveyBoardCard', () => {
    it('answers a single-choice survey in one click and takes the survey the server returns', async () => {
        const saved = answered();
        retroRequest.mockResolvedValue({ survey: saved });

        const { ctx } = renderInBoard(
            <SurveyBoardCard survey={survey()} />,
            boardContext(),
        );

        expect(
            within(card()).getByRole('radiogroup', {
                name: 'How was the sprint?',
            }),
        ).toBeTruthy();

        fireEvent.click(within(card()).getByRole('radio', { name: 'Great' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'survey.upsert',
                survey: saved,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/retros/retro-1/surveys/survey-1/response',
                method: 'put',
            }),
            { optionId: 'great' },
        );
        expect(ctx.invalidateSurvey).toHaveBeenCalledWith('survey-1');
    });

    it('answers a single-choice survey with a digit typed in the card, kept from the reaction shortcuts', () => {
        retroRequest.mockResolvedValue({ survey: answered() });

        renderInBoard(<SurveyBoardCard survey={survey()} />, boardContext());

        const isDefaultAllowed = fireEvent.keyDown(
            within(card()).getByRole('radio', { name: 'Great' }),
            { key: '2' },
        );

        expect(isDefaultAllowed).toBe(false);
        expect(retroRequest).toHaveBeenCalledWith(expect.anything(), {
            optionId: 'ok',
        });
    });

    it('shows no figure while the results are hidden, and says how to join the discussion', () => {
        renderInBoard(
            <SurveyBoardCard
                survey={survey({ responseCount: 3, commentCount: 1 })}
            />,
            boardContext(),
        );

        expect(card().textContent).not.toContain('%');
        expect(within(card()).getByText('3 responses')).toBeTruthy();
        expect(card().textContent).toContain(
            '1 · Answer to join the discussion',
        );
        expect(
            card().querySelector('[data-slot="survey-discussion"] .sr-only')
                ?.textContent,
        ).toContain('Comments (1)');
        expect(
            card()
                .querySelector('[data-slot="survey-discussion"] svg')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
        expect(
            within(card()).queryByRole('button', { name: /^Comments/ }),
        ).toBeNull();
    });

    it('shows the results as "count · percent" once answered, with "Withdraw my answer"', async () => {
        retroRequest.mockResolvedValue({ survey: survey() });

        renderInBoard(<SurveyBoardCard survey={answered()} />, boardContext());

        expect(within(card()).getByText('1 · 100%')).toBeTruthy();
        expect(within(card()).getByText('0 · 0%')).toBeTruthy();
        expect(within(card()).getByText('1 response')).toBeTruthy();

        fireEvent.click(
            within(card()).getByRole('button', { name: 'Withdraw my answer' }),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: '/retros/retro-1/surveys/survey-1/response',
                    method: 'delete',
                }),
            ),
        );
    });

    it('sends the ticked options of a multiple-choice survey in the order of the survey, once something changed', async () => {
        const multiple = answered({ kind: 'multiple' });
        retroRequest.mockResolvedValue({ survey: multiple });

        renderInBoard(<SurveyBoardCard survey={multiple} />, boardContext());

        const update = within(card()).getByRole('button', {
            name: 'Update answer',
        });

        expect(update.hasAttribute('disabled')).toBe(true);

        fireEvent.click(within(card()).getByRole('checkbox', { name: 'OK' }));

        expect(update.hasAttribute('disabled')).toBe(false);

        fireEvent.click(update);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(expect.anything(), {
                optionIds: ['great', 'ok'],
            }),
        );
    });

    it('sends a trimmed text, in a field named by the question', async () => {
        const text = survey({ kind: 'text', options: [] });
        retroRequest.mockResolvedValue({ survey: text });

        renderInBoard(<SurveyBoardCard survey={text} />, boardContext());

        const field = within(card()).getByRole('textbox', {
            name: 'How was the sprint?',
        });
        const submit = within(card()).getByRole('button', { name: 'Submit' });

        expect(submit.hasAttribute('disabled')).toBe(true);

        fireEvent.change(field, { target: { value: '  Fine  ' } });
        fireEvent.click(submit);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(expect.anything(), {
                text: 'Fine',
            }),
        );
    });

    it('starts the draft again when the saved answer changes', () => {
        const multiple = answered({ kind: 'multiple' });
        const ctx = boardContext();
        const { rerender } = renderInBoard(
            <SurveyBoardCard survey={multiple} />,
            ctx,
        );

        fireEvent.click(within(card()).getByRole('checkbox', { name: 'OK' }));

        expect(
            within(card())
                .getByRole('checkbox', { name: 'OK' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        rerender(
            <BoardProvider value={ctx}>
                <SurveyBoardCard
                    survey={{ ...multiple, myOptionIds: [], responseCount: 0 }}
                />
            </BoardProvider>,
        );

        expect(
            within(card())
                .getByRole('checkbox', { name: 'OK' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            within(card())
                .getByRole('checkbox', { name: 'Great' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('keeps a closed survey readable with its controls disabled', () => {
        renderInBoard(
            <SurveyBoardCard survey={answered({ isClosed: true })} />,
            boardContext(),
        );

        expect(within(card()).getByText('Closed')).toBeTruthy();
        expect(
            within(card())
                .getByRole('radio', { name: 'Great' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(
            within(card()).queryByRole('button', {
                name: 'Withdraw my answer',
            }),
        ).toBeNull();
    });

    it('blocks answering on a locked board without calling the survey closed', () => {
        renderInBoard(
            <SurveyBoardCard survey={answered()} />,
            boardContext(retroSnapshot({ retro: { isLocked: true } })),
        );

        expect(within(card()).queryByText('Closed')).toBeNull();
        expect(
            within(card())
                .getByRole('radio', { name: 'OK' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(
            within(card()).queryByRole('button', {
                name: 'Withdraw my answer',
            }),
        ).toBeNull();
    });

    it('gives the survey actions to the facilitator only', () => {
        const { unmount } = renderInBoard(
            <SurveyBoardCard survey={survey()} />,
            boardContext(),
        );

        expect(
            within(card()).getByRole('button', { name: 'Survey actions' }),
        ).toBeTruthy();

        unmount();

        renderInBoard(
            <SurveyBoardCard survey={survey()} />,
            boardContext(retroSnapshot({ viewer: { isFacilitator: false } })),
        );

        expect(
            within(card()).queryByRole('button', { name: 'Survey actions' }),
        ).toBeNull();
    });

    it('offers no change of who answered on a locked board, and ties the edit hint to its entry', async () => {
        const user = userEvent.setup();

        renderInBoard(
            <SurveyBoardCard survey={answered()} />,
            boardContext(retroSnapshot({ retro: { isLocked: true } })),
        );

        await user.click(
            within(card()).getByRole('button', { name: 'Survey actions' }),
        );

        expect(
            screen
                .getByRole('menuitemcheckbox', { name: 'Show who answered' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
        expect(
            screen.getByRole('menuitem', {
                name: 'Edit survey',
                description: 'Edit is only possible before the first answer.',
            }),
        ).toBeTruthy();
    });

    it('gives the keyboard back to "Survey actions" when the edit dialog is cancelled', async () => {
        const user = userEvent.setup();

        renderInBoard(<SurveyBoardCard survey={survey()} />, boardContext());

        const actions = within(card()).getByRole('button', {
            name: 'Survey actions',
        });

        await user.click(actions);
        await user.click(screen.getByRole('menuitem', { name: 'Edit survey' }));

        const dialog = await screen.findByRole('dialog', {
            name: 'Edit survey',
        });

        await user.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );

        await waitFor(() => expect(document.activeElement).toBe(actions));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('names who answered an option when the survey shows them', () => {
        renderInBoard(
            <SurveyBoardCard
                survey={answered({
                    showVoters: true,
                    options: [
                        {
                            id: 'great',
                            label: 'Great',
                            position: 0,
                            count: 1,
                            voters: ['me'],
                        },
                        {
                            id: 'ok',
                            label: 'OK',
                            position: 1,
                            count: 0,
                            voters: [],
                        },
                    ],
                })}
            />,
            boardContext(),
        );

        expect(
            card().querySelector('li img[alt="Alice Martin"]'),
        ).not.toBeNull();
    });

    it('opens the comments of an answered survey', () => {
        renderInBoard(
            <SurveyBoardCard survey={answered({ commentCount: 0 })} />,
            boardContext(),
        );

        const toggle = within(card()).getByRole('button', {
            name: 'Comments (0)',
        });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('data-slot')).toBe('survey-comments-toggle');

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(within(card()).getByLabelText('Write a comment…')).toBeTruthy();
        expect(
            within(card()).getByText('Your name is shown with your comment.'),
        ).toBeTruthy();
        expect(
            within(card()).getByRole('button', { name: 'Add a reaction' }),
        ).toBeTruthy();
    });
});

describe('SurveyResultList', () => {
    const completed = () =>
        boardContext(retroSnapshot({ retro: { phase: 'completed' } }));

    it('lists the surveys read only under "Surveys", each named by its question', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[
                    answered(),
                    answered({
                        id: 'survey-2',
                        kind: 'multiple',
                        question: 'What helped?',
                    }),
                ]}
            />,
            completed(),
        );

        const section = screen.getByRole('region', { name: 'Surveys' });

        expect(section.querySelector(':scope > h2')?.textContent).toBe(
            'Surveys',
        );
        expect(within(section).getAllByRole('article')).toHaveLength(2);
        expect(
            section.querySelector('article[aria-label="What helped?"]'),
        ).not.toBeNull();
        expect(within(section).queryByRole('radio')).toBeNull();
        expect(within(section).queryByRole('checkbox')).toBeNull();
        expect(
            within(section).queryByRole('button', { name: 'Submit' }),
        ).toBeNull();
        expect(
            within(section).queryByRole('button', {
                name: 'Withdraw my answer',
            }),
        ).toBeNull();
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('gives no survey actions, even to the facilitator', () => {
        renderInBoard(<SurveyResultList surveys={[answered()]} />, completed());

        expect(
            document.querySelector('[aria-label="Survey actions"]'),
        ).toBeNull();
    });

    it('draws one bar per option with its "count · percent"', () => {
        renderInBoard(<SurveyResultList surveys={[answered()]} />, completed());

        const bars = [
            ...card().querySelectorAll<HTMLElement>(
                '[data-slot="survey-result-bar"] > div',
            ),
        ];

        expect(bars.map((bar) => bar.style.width)).toEqual(['100%', '0%']);
        expect(within(card()).getByText('1 · 100%')).toBeTruthy();
        expect(within(card()).getByText('1 response')).toBeTruthy();
    });

    it('says "No answers yet." for a text survey nobody answered', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[
                    survey({
                        kind: 'text',
                        options: [],
                        isClosed: true,
                        resultsVisible: true,
                        textAnswers: [],
                    }),
                ]}
            />,
            completed(),
        );

        expect(within(card()).getByText('No answers yet.')).toBeTruthy();
        expect(
            within(card()).queryByText('Results are not visible yet.'),
        ).toBeNull();
        expect(within(card()).queryByRole('textbox')).toBeNull();
    });

    it('shows the results and the discussion to a viewer who never answered', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[
                    answered({
                        isClosed: true,
                        myOptionIds: [],
                        responseCount: 3,
                        commentCount: 2,
                        options: [
                            {
                                id: 'great',
                                label: 'Great',
                                position: 0,
                                count: 2,
                                voters: null,
                            },
                            {
                                id: 'ok',
                                label: 'OK',
                                position: 1,
                                count: 1,
                                voters: null,
                            },
                        ],
                    }),
                ]}
            />,
            completed(),
        );

        expect(within(card()).getByText('2 · 67%')).toBeTruthy();
        expect(within(card()).getByText('1 · 33%')).toBeTruthy();
        expect(within(card()).getByText('3 responses')).toBeTruthy();
        expect(
            within(card()).getByRole('button', { name: 'Comments (2)' }),
        ).toBeTruthy();
        expect(card().textContent).not.toContain(
            'Answer to join the discussion',
        );
    });

    it('never asks for an answer once the retro is completed, whatever the payload holds', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[survey({ responseCount: 3, commentCount: 1 })]}
            />,
            completed(),
        );

        expect(card().textContent).not.toContain(
            'Answer to join the discussion',
        );
        expect(
            card().querySelector('[data-slot="survey-discussion"]'),
        ).toBeNull();
        expect(card().textContent).not.toContain('%');
        expect(within(card()).getByText('3 responses')).toBeTruthy();
    });

    it('says "Closed" only on a survey the facilitator closed', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[
                    answered(),
                    answered({
                        id: 'survey-2',
                        question: 'What helped?',
                        isClosed: true,
                    }),
                ]}
            />,
            completed(),
        );

        expect(within(card()).queryByText('Closed')).toBeNull();
        expect(
            within(
                screen.getByRole('article', { name: 'What helped?' }),
            ).getByText('Closed'),
        ).toBeTruthy();
    });

    it('opens the comments without a field to write one', () => {
        renderInBoard(
            <SurveyResultList
                surveys={[
                    answered({
                        commentCount: 1,
                        comments: [
                            {
                                id: 'comment-1',
                                surveyId: 'survey-1',
                                parentCommentId: null,
                                isMine: true,
                                deleted: false,
                                content: 'Agreed.',
                                author: null,
                                createdAt: '2026-10-02T09:00:00Z',
                                replies: [],
                            },
                        ],
                    }),
                ]}
            />,
            completed(),
        );

        fireEvent.click(
            within(card()).getByRole('button', { name: 'Comments (1)' }),
        );

        expect(within(card()).getByText('Agreed.')).toBeTruthy();
        expect(within(card()).queryByRole('textbox')).toBeNull();
        expect(
            within(card()).queryByRole('button', { name: 'Reply' }),
        ).toBeNull();
    });

    it('renders nothing without a survey', () => {
        const { container } = renderInBoard(
            <SurveyResultList surveys={[]} />,
            completed(),
        );

        expect(container.querySelector('section')).toBeNull();
    });
});
