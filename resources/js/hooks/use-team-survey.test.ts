import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeamSurvey } from '@/hooks/use-team-survey';
import { RetroRequestError } from '@/lib/retro/api';
import type { SurveySnapshot } from '@/lib/surveys/types';
import { surveySnapshot } from '@/test/survey-snapshot';

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));

vi.mock('@/hooks/use-survey-channel', () => ({
    useSurveyChannel: () => ({
        online: [],
        connected: true,
        reconnecting: false,
    }),
}));

vi.mock('@/lib/surveys/api', () => ({
    surveyApi: { snapshot: mocks.snapshot },
}));

beforeEach(() => {
    mocks.snapshot.mockReset();
});

describe('useTeamSurvey', () => {
    it('says the survey was deleted on a 404', async () => {
        mocks.snapshot.mockRejectedValue(new RetroRequestError(404, ''));
        const { result } = renderHook(() => useTeamSurvey(surveySnapshot()));

        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.gone).toBe('deleted');
    });

    it('says the access ended when the viewer lost it on a 403', async () => {
        mocks.snapshot.mockRejectedValue(new RetroRequestError(403, ''));
        const { result } = renderHook(() => useTeamSurvey(surveySnapshot()));

        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.gone).toBe('ended');
    });

    it('keeps the newer snapshot when an older answer lands last', async () => {
        const answers: Array<(fresh: SurveySnapshot) => void> = [];
        mocks.snapshot.mockImplementation(
            () =>
                new Promise<SurveySnapshot>((resolve) => {
                    answers.push(resolve);
                }),
        );
        const { result } = renderHook(() => useTeamSurvey(surveySnapshot()));

        let older: Promise<boolean> = Promise.resolve(false);
        let newer: Promise<boolean> = Promise.resolve(false);

        act(() => {
            older = result.current.refetch();
            newer = result.current.refetch();
        });

        await act(async () => {
            answers[1](
                surveySnapshot({
                    progress: { responses: 6, completed: 5, audience: 11 },
                }),
            );
            await newer;
            answers[0](
                surveySnapshot({
                    progress: { responses: 5, completed: 4, audience: 11 },
                }),
            );
            await older;
        });

        expect(result.current.snapshot.progress.responses).toBe(6);
    });
});
