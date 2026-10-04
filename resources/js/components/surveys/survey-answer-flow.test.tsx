import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyAnswerFlow } from '@/components/surveys/survey-answer-flow';
import { RetroRequestError } from '@/lib/retro/api';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';
import { surveyAnswer, surveyQuestion } from '@/test/survey-snapshot';

const mobile = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile.value }));

vi.mock('@/hooks/use-single-key-shortcuts', async () => {
    const preference = await import('@/lib/shortcuts/preference');

    return {
        useSingleKeyShortcuts: () => [
            preference.singleKeyShortcutsEnabled(),
            () => {},
        ],
    };
});

function renderFlow(
    questions: SurveyQuestionPayload[],
    props: Partial<Parameters<typeof SurveyAnswerFlow>[0]> = {},
) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onFinish = vi.fn().mockResolvedValue(undefined);
    const view = renderWithProviders(
        <SurveyAnswerFlow
            questions={questions}
            onSave={onSave}
            onFinish={onFinish}
            {...props}
        />,
    );

    return { ...view, onSave, onFinish };
}

function step(): HTMLElement {
    return document.querySelector('[data-test="survey-step"]') as HTMLElement;
}

const fiveKinds = [
    surveyQuestion('a', 'scale', {
        label: 'How was the sprint?',
        scaleLabels: ['Bad', 'Great'],
    }),
    surveyQuestion('b', 'nps', { label: 'Would you recommend the team?' }),
    surveyQuestion('c', 'single', { label: 'How often?' }),
    surveyQuestion('d', 'multiple', { label: 'Which rituals?' }),
    surveyQuestion('e', 'text', { label: 'Anything else?' }),
];

beforeEach(() => {
    mobile.value = false;
    setSingleKeyShortcuts(true);
});

afterEach(() => {
    vi.useRealTimers();
    setSingleKeyShortcuts(true);
});

describe('SurveyAnswerFlow', () => {
    it('shows each of the five kinds as the current step, with its badge and its control', () => {
        const expectations: [string, string, () => HTMLElement][] = [
            [
                'How was the sprint?',
                'Scale 1 to 5',
                () =>
                    screen.getByRole('radiogroup', {
                        name: 'How was the sprint?',
                    }),
            ],
            [
                'Would you recommend the team?',
                'NPS',
                () =>
                    screen.getByRole('radiogroup', {
                        name: 'Would you recommend the team?',
                    }),
            ],
            [
                'How often?',
                'Single choice',
                () => screen.getByRole('radiogroup', { name: 'How often?' }),
            ],
            [
                'Which rituals?',
                'Multiple choice',
                () => screen.getByRole('group', { name: 'Which rituals?' }),
            ],
            [
                'Anything else?',
                'Free text',
                () => screen.getByRole('textbox', { name: 'Anything else?' }),
            ],
        ];

        expectations.forEach(([label, badge, control], index) => {
            const { unmount } = renderFlow(fiveKinds, { initialStep: index });

            expect(
                screen.getByRole('heading', { level: 2, name: label }),
            ).toBeTruthy();
            expect(step().getAttribute('data-step')).toBe(String(index));
            expect(screen.getByText(badge)).toBeTruthy();
            expect(control()).toBeTruthy();
            expect(screen.getByText(`Question ${index + 1} of 5`)).toBeTruthy();
            unmount();
        });
    });

    it('names the two ends of an NPS under its scale', () => {
        renderFlow(fiveKinds, { initialStep: 1 });

        expect(screen.getByText('0 · Not at all likely')).toBeTruthy();
        expect(screen.getByText('10 · Extremely likely')).toBeTruthy();
    });

    it('starts on the first question without an answer', () => {
        renderFlow([
            surveyQuestion('a', 'scale', {
                myAnswer: surveyAnswer({ value: 3 }),
            }),
            surveyQuestion('b', 'nps', { label: 'Recommend?' }),
        ]);

        expect(step().getAttribute('data-step')).toBe('1');
        expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    });

    it('saves a scale the moment it is picked', async () => {
        const { onSave } = renderFlow(fiveKinds);

        fireEvent.click(screen.getByRole('radio', { name: '4' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0].id).toBe('a');
        expect(onSave.mock.calls[0][1]).toBe(4);
    });

    it('saves a text 600 ms after the last change, and when leaving the step', async () => {
        vi.useFakeTimers();

        const { onSave } = renderFlow(fiveKinds, { initialStep: 4 });
        const field = screen.getByRole('textbox', { name: 'Anything else?' });

        fireEvent.change(field, { target: { value: 'Mo' } });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        fireEvent.change(field, { target: { value: 'More pairing' } });
        act(() => {
            vi.advanceTimersByTime(599);
        });

        expect(onSave).not.toHaveBeenCalled();

        await act(async () => vi.advanceTimersByTime(1));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0][1]).toBe('More pairing');

        fireEvent.change(field, { target: { value: 'More pairing!' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        });

        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onSave.mock.calls[1][1]).toBe('More pairing!');
        expect(step().getAttribute('data-step')).toBe('3');
    });

    it('keeps the viewer on a required question left without an answer', () => {
        renderFlow([
            surveyQuestion('a', 'single', {
                label: 'How often?',
                isRequired: true,
            }),
            surveyQuestion('b', 'text'),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(step().getAttribute('data-step')).toBe('0');
        expect(screen.getByRole('alert').textContent).toBe(
            'An answer is required.',
        );
        expect(
            screen
                .getByRole('radiogroup', { name: 'How often?' })
                .getAttribute('aria-invalid'),
        ).toBe('true');
        expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
    });

    it('drops the required error as soon as the question is answered', () => {
        renderFlow([
            surveyQuestion('a', 'single', {
                label: 'How often?',
                isRequired: true,
            }),
            surveyQuestion('b', 'text'),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getAllByRole('radio')[0]);

        expect(screen.queryByText('An answer is required.')).toBeNull();
        expect(
            screen
                .getByRole('radiogroup', { name: 'How often?' })
                .getAttribute('aria-invalid'),
        ).toBeNull();
    });

    it('keeps a value whose save failed, with "Not saved" and a retry', async () => {
        const onSave = vi
            .fn()
            .mockRejectedValueOnce(new RetroRequestError(500, 'Server error'))
            .mockResolvedValue(undefined);

        renderFlow(fiveKinds, { onSave });
        fireEvent.click(screen.getByRole('radio', { name: '2' }));

        expect(await screen.findByText('Not saved')).toBeTruthy();
        expect(
            (screen.getByRole('radio', { name: '2' }) as HTMLInputElement)
                .checked,
        ).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(screen.queryByText('Not saved')).toBeNull());
        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onSave.mock.calls[1][1]).toBe(2);
    });

    it('answers an NPS with the digit keys, 0 included, and goes on with Enter', async () => {
        const { onSave } = renderFlow(fiveKinds, { initialStep: 1 });

        fireEvent.keyDown(document.body, { key: '0' });

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][1]).toBe(0);
        expect(
            (screen.getByRole('radio', { name: '0' }) as HTMLInputElement)
                .checked,
        ).toBe(true);

        fireEvent.keyDown(document.body, { key: 'Enter' });

        expect(step().getAttribute('data-step')).toBe('2');
    });

    it('ignores a digit a scale does not have', () => {
        const { onSave } = renderFlow(fiveKinds);

        fireEvent.keyDown(document.body, { key: '7' });

        expect(onSave).not.toHaveBeenCalled();
    });

    it('lets the digits and Enter alone while a text field has the focus', () => {
        renderFlow(
            [
                surveyQuestion('a', 'scale', {
                    label: 'Mood',
                    allowsComment: true,
                }),
                surveyQuestion('b', 'text'),
            ],
            {},
        );
        const comment = screen.getByRole('textbox', {
            name: 'Why this score? (optional)',
        });

        comment.focus();
        fireEvent.keyDown(comment, { key: '3' });
        fireEvent.keyDown(comment, { key: 'Enter' });

        expect(
            screen
                .getAllByRole('radio')
                .some((radio) => (radio as HTMLInputElement).checked),
        ).toBe(false);
        expect(step().getAttribute('data-step')).toBe('0');
    });

    it('shows the real keys of the question, and no hint nor digits once single-key shortcuts are off', () => {
        const { unmount, onSave } = renderFlow(fiveKinds, { initialStep: 1 });
        const hint = document.querySelector('[data-slot="survey-key-hint"]');

        expect(hint?.textContent).toContain('0');
        expect(hint?.textContent).toContain('9');
        unmount();

        setSingleKeyShortcuts(false);
        renderFlow(fiveKinds, { initialStep: 1, onSave });

        expect(
            document.querySelector('[data-slot="survey-key-hint"]'),
        ).toBeNull();

        fireEvent.keyDown(document.body, { key: '8' });
        fireEvent.keyDown(document.body, { key: 'Enter' });

        expect(onSave).not.toHaveBeenCalled();
        expect(step().getAttribute('data-step')).toBe('1');
    });

    it('moves the focus to the heading of each new step', () => {
        renderFlow(fiveKinds);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(document.activeElement).toBe(
            screen.getByRole('heading', {
                level: 2,
                name: 'Would you recommend the team?',
            }),
        );
    });

    it('finishes on the last step, flushing what is pending first', async () => {
        vi.useFakeTimers();

        const { onSave, onFinish } = renderFlow(fiveKinds, {
            initialStep: 4,
        });

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Thanks' },
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(
            onFinish.mock.invocationCallOrder[0],
        );
    });

    it('waits for a pick still being saved before sending the response', async () => {
        let resolveSave: () => void = () => {};
        const onSave = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSave = resolve;
                }),
        );
        const { onFinish } = renderFlow([surveyQuestion('a', 'scale')], {
            onSave,
        });

        fireEvent.click(screen.getByRole('radio', { name: '4' }));
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        await act(async () => {});
        expect(onFinish).not.toHaveBeenCalled();

        await act(async () => resolveSave());

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    });

    it('retries an answer whose save failed before sending the response', async () => {
        const onSave = vi
            .fn()
            .mockRejectedValueOnce(new RetroRequestError(500, 'Server error'))
            .mockResolvedValue(undefined);
        const { onFinish } = renderFlow([surveyQuestion('a', 'scale')], {
            onSave,
        });

        fireEvent.click(screen.getByRole('radio', { name: '2' }));
        expect(await screen.findByText('Not saved')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
        expect(onSave).toHaveBeenCalledTimes(2);
    });

    it('does not send the response while an answer is not saved, and goes back to it', async () => {
        const onSave = vi.fn(async (question: SurveyQuestionPayload) => {
            if (question.id === 'a') {
                throw new RetroRequestError(500, 'Server error');
            }
        });
        const { onFinish } = renderFlow(fiveKinds, { onSave });

        fireEvent.click(screen.getByRole('radio', { name: '2' }));
        expect(await screen.findByText('Not saved')).toBeTruthy();

        for (let next = 0; next < 4; next++) {
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        }

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(step().getAttribute('data-step')).toBe('0'));
        expect(onFinish).not.toHaveBeenCalled();
        expect(screen.getByText('Not saved')).toBeTruthy();
        expect(
            screen.getByText('Your answers could not be sent. Try again.'),
        ).toBeTruthy();
    });

    it('goes back to the question a refused submission names', async () => {
        const onFinish = vi.fn().mockRejectedValue(
            new RetroRequestError(422, 'Invalid', {
                'questions.c': ['An answer is required.'],
            }),
        );

        renderFlow(fiveKinds, { initialStep: 4, onFinish });
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(step().getAttribute('data-step')).toBe('2'));
        expect(screen.getByRole('alert').textContent).toBe(
            'An answer is required.',
        );
    });

    it('says why a submission naming no question was refused', async () => {
        const onFinish = vi.fn().mockRejectedValue(
            new RetroRequestError(422, 'Invalid', {
                survey: ['Answer at least one question before finishing.'],
            }),
        );

        renderFlow(fiveKinds, { initialStep: 4, onFinish });
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        expect(
            await screen.findByText(
                'Answer at least one question before finishing.',
            ),
        ).toBeTruthy();
    });

    it('in preview, sends nothing and closes with "Finish"', async () => {
        const { onSave, onFinish } = renderFlow(fiveKinds, {
            preview: true,
            initialStep: 4,
        });

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Draft' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
            'Draft',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
        expect(onSave).not.toHaveBeenCalled();
    });

    describe('on a phone', () => {
        beforeEach(() => {
            mobile.value = true;
        });

        it('docks "Previous" as an icon and "Next" in a footer, the scale on 2.75rem targets', () => {
            renderFlow(fiveKinds);
            const footer = document.querySelector(
                '[data-slot="survey-flow-footer"]',
            );
            const previous = screen.getByRole('button', { name: 'Previous' });

            expect(footer?.contains(previous)).toBe(true);
            expect(previous.textContent).toBe('');
            expect(
                footer?.contains(screen.getByRole('button', { name: 'Next' })),
            ).toBe(true);
            expect(step().getAttribute('data-layout')).toBe('phone');
            expect(
                document.querySelector('[data-slot="survey-key-hint"]'),
            ).toBeNull();
        });

        it('puts an NPS on two rows', () => {
            renderFlow(fiveKinds, { initialStep: 1 });

            expect(
                document.querySelector('[data-slot="survey-question"]')
                    ?.className,
            ).toContain('basis-1/7');
        });

        it('keeps the footer out of the scroll area of a text', () => {
            renderFlow(fiveKinds, { initialStep: 4 });
            const scroller = document.querySelector(
                '[data-slot="survey-flow-scroll"]',
            );
            const footer = document.querySelector(
                '[data-slot="survey-flow-footer"]',
            );

            expect(scroller?.contains(screen.getByRole('textbox'))).toBe(true);
            expect(scroller?.contains(footer as Node)).toBe(false);
        });
    });
});

describe('SurveyAnswerFlow, read only', () => {
    it('shows each question without taking an answer, and without "Finish"', () => {
        const { onSave } = renderFlow(fiveKinds.slice(0, 2), {
            readOnly: true,
        });

        expect(
            (screen.getAllByRole('radio')[0] as HTMLInputElement).disabled,
        ).toBe(true);

        fireEvent.keyDown(document.body, { key: '3' });
        fireEvent.click(screen.getByRole('button', { name: /Next/ }));

        expect(onSave).not.toHaveBeenCalled();
        expect(step().getAttribute('data-step')).toBe('1');
        expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();
    });
});
