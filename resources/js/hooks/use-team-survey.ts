import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { RetroRequestError } from '@/lib/retro/api';
import { surveyApi } from '@/lib/surveys/api';
import { surveyReducer } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot, SurveyStatus } from '@/lib/surveys/types';
import { useSurveyChannel } from './use-survey-channel';

const RefetchDelayMs = 1000;

const SessionExpiredStatuses = [401, 419];

export function useTeamSurvey(initial: SurveySnapshot) {
    const [snapshot, dispatch] = useReducer(surveyReducer, initial);
    const [gone, setGone] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(snapshot);

    latest.current = snapshot;

    const refetch = useCallback(async () => {
        try {
            dispatch({
                type: 'snapshot.replace',
                snapshot: await surveyApi.snapshot(initial.survey.id),
            });
        } catch (error) {
            if (!(error instanceof RetroRequestError)) {
                return;
            }

            if (error.status === 404) {
                setGone(true);

                return;
            }

            if (SessionExpiredStatuses.includes(error.status)) {
                setSessionExpired(true);
            }

            // Anything else: the next event or reconnect asks again.
        }
    }, [initial.survey.id]);

    const scheduleRefetch = useCallback(() => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => void refetch(), RefetchDelayMs);
    }, [refetch]);

    useEffect(
        () => () => {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    const channel = useSurveyChannel(initial.survey.id, !gone, {
        onEvent: (event) => {
            switch (event.name) {
                case 'survey.changed': {
                    const payload = event.payload as {
                        version: number;
                        status: SurveyStatus;
                    };

                    if (
                        payload.version !== latest.current.survey.version ||
                        payload.status !== latest.current.survey.status
                    ) {
                        void refetch();
                    }

                    break;
                }
                case 'survey.responses.changed': {
                    const payload = event.payload as {
                        responses: number;
                        completed: number;
                    };

                    dispatch({ type: 'progress.set', ...payload });

                    if (latest.current.me.canSeeResults) {
                        scheduleRefetch();
                    }

                    break;
                }
                case 'survey.deleted':
                    setGone(true);
                    break;
            }
        },
        onResync: () => void refetch(),
    });

    return {
        snapshot,
        dispatch,
        refetch,
        gone,
        ...channel,
        realtime: realtimeState(channel.connected, channel.online),
        connection: {
            reconnecting: channel.reconnecting,
            expired: sessionExpired,
        },
    };
}
