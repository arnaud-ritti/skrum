import { useCallback, useEffect, useState } from 'react';
import { surveyApi } from '@/lib/surveys/api';
import type { SurveyComparison } from '@/lib/surveys/types';

export type ComparisonLoad =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; comparison: SurveyComparison | null };

type Settled = { key: string; load: ComparisonLoad };

/** The comparison of a survey with another one; nothing is asked while `withId` is null. */
export function useSurveyComparison(surveyId: string, withId: string | null) {
    const [attempt, setAttempt] = useState(0);
    const [settled, setSettled] = useState<Settled | null>(null);
    const key = withId === null ? null : `${surveyId}|${withId}|${attempt}`;

    useEffect(() => {
        if (key === null || withId === null) {
            return;
        }

        let isCurrent = true;

        surveyApi.comparison(surveyId, withId).then(
            ({ comparison }) => {
                if (isCurrent) {
                    setSettled({ key, load: { status: 'ready', comparison } });
                }
            },
            () => {
                if (isCurrent) {
                    setSettled({ key, load: { status: 'error' } });
                }
            },
        );

        return () => {
            isCurrent = false;
        };
    }, [key, surveyId, withId]);

    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    let load: ComparisonLoad = { status: 'loading' };

    if (key === null) {
        load = { status: 'idle' };
    }

    if (key !== null && settled?.key === key) {
        load = settled.load;
    }

    return { load, retry };
}
