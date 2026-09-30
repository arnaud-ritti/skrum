import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { RetroRequestError, retroRequest } from './api';
import type { RetroPhase, SurveyPayload } from './types';

export const SurveyPhases: RetroPhase[] = [
    'writing',
    'grouping',
    'voting',
    'discussing',
];

export const MaxSurveys = 10;

export const SurveyRefetchDelayMs = 1_000;

export async function fetchSurvey(
    retroId: string,
    surveyId: string,
): Promise<SurveyPayload> {
    const response = await retroRequest<{ survey: SurveyPayload }>(
        SurveysController.show({ retro: retroId, survey: surveyId }),
    );

    return response.survey;
}

/**
 * Broadcasts only carry counts; the survey itself is refetched when it is
 * new, changed shape, or the viewer may see its results.
 */
export function needsSurveyRefetch(
    local: SurveyPayload | undefined,
    version: number,
): boolean {
    if (local === undefined) {
        return true;
    }

    return local.version !== version || local.resultsVisible;
}

export type SurveyRefetcher = {
    schedule: (surveyId: string) => void;
    cancel: () => void;
};

type Handlers = {
    onSurvey: (survey: SurveyPayload) => void;
    onGone: (surveyId: string) => void;
    onError: (error: unknown) => void;
};

/**
 * Collapses every survey event of one second into a single request per
 * survey, so a burst of answers does not make every client refetch each
 * time.
 */
export function createSurveyRefetcher(
    retroId: string,
    handlers: Handlers,
): SurveyRefetcher {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const load = async (surveyId: string) => {
        try {
            handlers.onSurvey(await fetchSurvey(retroId, surveyId));
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 404) {
                handlers.onGone(surveyId);

                return;
            }

            handlers.onError(error);
        }
    };

    return {
        schedule(surveyId) {
            if (timers.has(surveyId)) {
                return;
            }

            timers.set(
                surveyId,
                setTimeout(() => {
                    timers.delete(surveyId);
                    void load(surveyId);
                }, SurveyRefetchDelayMs),
            );
        },
        cancel() {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        },
    };
}
