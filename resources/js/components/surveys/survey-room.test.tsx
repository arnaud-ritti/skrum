import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyRoom } from '@/components/surveys/survey-room';
import type { SurveySnapshot } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';
import {
    surveyAnswer,
    surveyQuestion,
    surveySnapshot,
} from '@/test/survey-snapshot';

const room = vi.hoisted(() => ({
    gone: false,
    connection: { reconnecting: false, expired: false },
    dispatch: vi.fn(),
}));

const api = vi.hoisted(() => ({
    saveAnswer: vi.fn(),
    withdrawAnswer: vi.fn(),
    submit: vi.fn(),
    reopenResponse: vi.fn(),
}));

vi.mock('@/hooks/use-team-survey', () => ({
    useTeamSurvey: (snapshot: SurveySnapshot) => ({
        snapshot,
        dispatch: room.dispatch,
        refetch: vi.fn(),
        gone: room.gone,
        online: [],
        realtime: room.connection.reconnecting ? 'reconnecting' : 'connected',
        connection: room.connection,
    }),
}));

vi.mock('@/lib/surveys/api', () => ({ surveyApi: api }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

beforeEach(() => {
    room.gone = false;
    room.connection = { reconnecting: false, expired: false };
    room.dispatch.mockReset();
    Object.values(api).forEach((mock) => mock.mockReset());
});

function renderRoom(snapshot: SurveySnapshot = surveySnapshot()) {
    return renderWithProviders(<SurveyRoom initial={snapshot} />);
}

describe('SurveyRoom', () => {
    it('frames the survey in the session shell: the team, the type, the anonymity badge, the viewer', () => {
        const { container } = renderRoom();

        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(
            screen.getByRole('region', { name: 'Survey' }).dataset.realtime,
        ).toBe('connected');
        expect(
            container.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Atlas · Survey');
        expect(screen.getByText('Anonymous answers')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/teams/t1');
        expect(screen.getByRole('img', { name: 'Mia Lopez' })).toBeTruthy();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Team pulse',
        );
    });

    it('names no team and links nowhere for a guest', () => {
        const { container } = renderRoom(
            surveySnapshot({
                survey: { teamName: null },
                me: { isGuest: true, name: 'Quiet Otter' },
                links: {
                    team: null,
                    show: '/surveys/s1',
                    results: '/surveys/s1/results',
                    edit: null,
                    healthCheck: null,
                },
            }),
        );

        expect(
            container.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Survey');
        expect(
            screen.queryByRole('link', { name: 'Back to the team' }),
        ).toBeNull();
        expect(
            screen.getByRole('img', { name: 'Quiet Otter (Guest)' }),
        ).toBeTruthy();
    });

    it('asks one question at a time, or all of them, by the survey setting', () => {
        const { unmount } = renderRoom();

        expect(
            document.querySelector('[data-test="survey-step"]'),
        ).not.toBeNull();
        unmount();

        renderRoom(surveySnapshot({ survey: { oneQuestionAtATime: false } }));

        expect(document.querySelector('[data-test="survey-step"]')).toBeNull();
        expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    it('saves an answer through the API and keeps the snapshot in step', async () => {
        const progress = { responses: 5, completed: 3, audience: 11 };
        const answer = surveyAnswer({ value: 4 });

        api.saveAnswer.mockResolvedValue({ answer, progress });
        renderRoom();

        fireEvent.click(screen.getByRole('radio', { name: '4' }));

        await waitFor(() =>
            expect(room.dispatch).toHaveBeenCalledWith({
                type: 'answer.set',
                questionId: 'a',
                answer,
                progress,
            }),
        );
        expect(api.saveAnswer).toHaveBeenCalledWith('s1', 'a', { value: 4 });
    });

    it('withdraws an answer the viewer emptied', async () => {
        vi.useFakeTimers();

        const progress = { responses: 3, completed: 3, audience: 11 };

        api.withdrawAnswer.mockResolvedValue({ answer: null, progress });
        renderRoom(
            surveySnapshot({
                questions: [
                    surveyQuestion('t', 'text', {
                        myAnswer: surveyAnswer({ text: 'Old' }),
                    }),
                ],
            }),
        );

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: '  ' },
        });
        await vi.advanceTimersByTimeAsync(600);
        vi.useRealTimers();

        expect(api.withdrawAnswer).toHaveBeenCalledWith('s1', 't');
        expect(api.saveAnswer).not.toHaveBeenCalled();
    });

    it('withdraws an answer emptied while its first save was still on its way', async () => {
        vi.useFakeTimers();

        const progress = { responses: 3, completed: 3, audience: 11 };
        let resolveSave: (value: unknown) => void = () => {};

        api.saveAnswer.mockReturnValue(
            new Promise((resolve) => {
                resolveSave = resolve;
            }),
        );
        api.withdrawAnswer.mockResolvedValue({ answer: null, progress });
        renderRoom(
            surveySnapshot({ questions: [surveyQuestion('t', 'text')] }),
        );

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Draft' },
        });
        await vi.advanceTimersByTimeAsync(600);
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: '' },
        });
        await vi.advanceTimersByTimeAsync(600);

        expect(api.withdrawAnswer).not.toHaveBeenCalled();

        resolveSave({ answer: surveyAnswer({ text: 'Draft' }), progress });
        await vi.advanceTimersByTimeAsync(0);
        vi.useRealTimers();

        expect(api.saveAnswer).toHaveBeenCalledTimes(1);
        expect(api.withdrawAnswer).toHaveBeenCalledWith('s1', 't');
    });

    it('sends the response with "Finish" and takes the snapshot it returns', async () => {
        const finished = surveySnapshot({ me: { hasSubmitted: true } });

        api.submit.mockResolvedValue(finished);
        renderRoom(
            surveySnapshot({
                questions: [
                    surveyQuestion('a', 'scale', {
                        myAnswer: surveyAnswer({ value: 3 }),
                    }),
                ],
            }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() =>
            expect(room.dispatch).toHaveBeenCalledWith({
                type: 'snapshot.replace',
                snapshot: finished,
            }),
        );
    });

    it('thanks a viewer who has finished, without results', () => {
        renderRoom(surveySnapshot({ me: { hasSubmitted: true } }));

        expect(
            screen.getByText('Thank you — your answers are saved.'),
        ).toBeTruthy();
        expect(
            screen.getByText('Results will show when the survey is closed.'),
        ).toBeTruthy();
        expect(document.querySelector('[data-test="survey-step"]')).toBeNull();
    });

    it('thanks a viewer who has finished, with the results', () => {
        renderRoom(
            surveySnapshot({
                me: { hasSubmitted: true, canSeeResults: true },
                results: {
                    belowThreshold: false,
                    responses: 4,
                    questions: { a: { responses: 4, mean: 4, buckets: [] } },
                },
            }),
        );

        expect(screen.getAllByText('4 responses').length).toBeGreaterThan(0);
    });

    it('reopens the response with "Change my answers" and starts again at the first question', async () => {
        const reopened = surveySnapshot({
            questions: [
                surveyQuestion('a', 'scale', {
                    myAnswer: surveyAnswer({ value: 3 }),
                }),
                surveyQuestion('b', 'nps', {
                    myAnswer: surveyAnswer({ value: 9 }),
                }),
            ],
        });

        api.reopenResponse.mockResolvedValue(reopened);
        renderRoom(surveySnapshot({ me: { hasSubmitted: true } }));

        fireEvent.click(
            screen.getByRole('button', { name: 'Change my answers' }),
        );

        await waitFor(() =>
            expect(room.dispatch).toHaveBeenCalledWith({
                type: 'snapshot.replace',
                snapshot: reopened,
            }),
        );
        expect(api.reopenResponse).toHaveBeenCalledWith('s1');
    });

    it('shows a closed survey with its results link', () => {
        renderRoom(
            surveySnapshot({
                survey: {
                    status: 'closed',
                    closedAt: '2026-10-03T16:00:00.000Z',
                },
            }),
        );

        expect(screen.getByText('This survey is closed.')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'See the results' })
                .getAttribute('href'),
        ).toBe('/surveys/s1/results');
    });

    it('shows the reconnecting banner with the survey sentence', () => {
        room.connection = { reconnecting: true, expired: false };
        renderRoom();

        expect(screen.getByRole('status').textContent).toContain(
            'Your answers are saved as you give them; the counter is paused.',
        );
    });

    it('says a deleted survey is gone, outside any realtime root', () => {
        room.gone = true;

        const { container } = renderRoom();

        expect(screen.getByText('This survey was deleted.')).toBeTruthy();
        expect(container.querySelector('[data-realtime]')).toBeNull();
        expect(
            screen
                .getAllByRole('link', { name: 'Back to the team' })
                .map((link) => link.getAttribute('href')),
        ).toEqual(['/teams/t1', '/teams/t1']);
    });

    it('gives an editor the way to the results and the Share dialog', () => {
        renderRoom(
            surveySnapshot({
                me: { isEditor: true },
                links: {
                    team: '/teams/t1',
                    show: '/surveys/s1',
                    results: '/surveys/s1/results',
                    edit: '/surveys/s1/edit',
                    healthCheck: null,
                },
            }),
        );

        expect(
            screen.getByRole('link', { name: 'Results' }).getAttribute('href'),
        ).toBe('/surveys/s1/results');
        expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    });

    it('gives a respondent no way to the results nor the Share dialog from the header', () => {
        renderRoom();

        expect(screen.queryByRole('link', { name: 'Results' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });
});
