import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyAnswerList } from '@/components/surveys/survey-answer-list';
import { RetroRequestError } from '@/lib/retro/api';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';
import { surveyQuestion } from '@/test/survey-snapshot';

const questions = [
    surveyQuestion('a', 'scale', { label: 'Mood', allowsComment: true }),
    surveyQuestion('b', 'single', { label: 'How often?', isRequired: true }),
    surveyQuestion('c', 'text', { label: 'Anything else?' }),
];

function renderList(
    shown: SurveyQuestionPayload[] = questions,
    props: Partial<Parameters<typeof SurveyAnswerList>[0]> = {},
) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onFinish = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
        <SurveyAnswerList
            questions={shown}
            onSave={onSave}
            onFinish={onFinish}
            {...props}
        />,
    );

    return { onSave, onFinish };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('SurveyAnswerList', () => {
    it('shows every question as a card, numbered, with one "Finish" under the list', () => {
        renderList();

        expect(screen.getAllByRole('article')).toHaveLength(3);
        expect(screen.getByText('1 / 3')).toBeTruthy();
        expect(screen.getByText('3 / 3')).toBeTruthy();
        expect(screen.getAllByRole('button', { name: 'Finish' })).toHaveLength(
            1,
        );
        expect(
            screen.getByRole('textbox', {
                name: 'Why this score? (optional)',
            }),
        ).toBeTruthy();
    });

    it('saves a pick at once and a text after a pause', async () => {
        vi.useFakeTimers();

        const { onSave } = renderList();

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
        });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0][1]).toBe('b-2');

        fireEvent.change(
            screen.getByRole('textbox', { name: 'Anything else?' }),
            { target: { value: 'Fewer meetings' } },
        );
        await act(async () => vi.advanceTimersByTime(600));

        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onSave.mock.calls[1][1]).toBe('Fewer meetings');
    });

    it('scrolls to the first required question left empty instead of finishing', () => {
        const scrollIntoView = vi.fn();

        Element.prototype.scrollIntoView = scrollIntoView;

        const { onFinish } = renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        expect(onFinish).not.toHaveBeenCalled();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert').textContent).toBe(
            'An answer is required.',
        );
        expect(
            screen
                .getByRole('radiogroup', { name: /How often\?/ })
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });

    it('drops the required error of a question once it is answered', async () => {
        Element.prototype.scrollIntoView = vi.fn();

        renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
        });

        expect(screen.queryByText('An answer is required.')).toBeNull();
    });

    it('finishes once every required question has an answer', async () => {
        const { onFinish } = renderList();

        fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    });

    it('marks the questions a refused submission names', async () => {
        Element.prototype.scrollIntoView = vi.fn();

        const onFinish = vi.fn().mockRejectedValue(
            new RetroRequestError(422, 'Invalid', {
                'questions.c': ['An answer is required.'],
            }),
        );

        renderList(questions, { onFinish });
        fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() =>
            expect(
                screen
                    .getByRole('textbox', { name: 'Anything else?' })
                    .getAttribute('aria-invalid'),
            ).toBe('true'),
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
        const { onFinish } = renderList(questions, { onSave });

        fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await act(async () => {});
        expect(onFinish).not.toHaveBeenCalled();

        await act(async () => resolveSave());

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    });

    it('does not send the response while an answer is not saved', async () => {
        Element.prototype.scrollIntoView = vi.fn();

        const onSave = vi
            .fn()
            .mockRejectedValue(new RetroRequestError(500, 'Server error'));
        const { onFinish } = renderList(questions, { onSave });

        fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
        expect(await screen.findByText('Not saved')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        expect(
            await screen.findByText(
                'Your answers could not be sent. Try again.',
            ),
        ).toBeTruthy();
        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onFinish).not.toHaveBeenCalled();
        expect(screen.getByText('Not saved')).toBeTruthy();
    });

    it('keeps a failed answer on screen with "Not saved"', async () => {
        const onSave = vi
            .fn()
            .mockRejectedValue(new RetroRequestError(500, 'Server error'));

        renderList(questions, { onSave });
        fireEvent.click(screen.getByRole('radio', { name: '5' }));

        expect(await screen.findByText('Not saved')).toBeTruthy();
        expect(
            (screen.getByRole('radio', { name: '5' }) as HTMLInputElement)
                .checked,
        ).toBe(true);
    });
});

describe('SurveyAnswerList, read only', () => {
    it('shows every question without taking an answer, and without "Finish"', () => {
        renderList(questions, { readOnly: true });

        expect(screen.getAllByRole('article')).toHaveLength(3);
        expect(
            (screen.getByRole('radio', { name: 'Weekly' }) as HTMLInputElement)
                .disabled,
        ).toBe(true);
        expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();
    });
});
