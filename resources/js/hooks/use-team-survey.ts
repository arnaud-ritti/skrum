import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { RetroRequestError } from '@/lib/retro/api';
import { surveyApi } from '@/lib/surveys/api';
import { surveyReducer } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot, SurveyStatus } from '@/lib/surveys/types';
import { useSurveyChannel } from './use-survey-channel';

const RefetchDelayMs = 1000;

const SessionExpiredStatuses = [401, 419];

export type SurveyGoneReason = 'deleted' | 'ended';

export function useTeamSurvey(initial: SurveySnapshot) {
    const [snapshot, dispatch] = useReducer(surveyReducer, initial);
    const [gone, setGone] = useState<SurveyGoneReason | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(snapshot);
    const latestRefetch = useRef(0);

    useEffect(() => {
        latest.current = snapshot;
    });

    /** Resolves true once the server's snapshot replaced the local one. */
    const refetch = useCallback(async (): Promise<boolean> => {
        const request = ++latestRefetch.current;

        try {
            const fresh = await surveyApi.snapshot(initial.survey.id);

            if (request !== latestRefetch.current) {
                return false;
            }

            dispatch({ type: 'snapshot.replace', snapshot: fresh });

            return true;
        } catch (error) {
            if (!(error instanceof RetroRequestError)) {
                return false;
            }

            if (error.status === 404) {
                setGone('deleted');

                return false;
            }

            if (error.status === 403) {
                setGone('ended');

                return false;
            }

            if (SessionExpiredStatuses.includes(error.status)) {
                setSessionExpired(true);
            }

            // Anything else: the next event or reconnect asks again.
            return false;
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

    const channel = useSurveyChannel(initial.survey.id, gone === null, {
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
                        audience: number;
                    };

                    dispatch({ type: 'progress.set', ...payload });

                    if (latest.current.me.canSeeResults) {
                        scheduleRefetch();
                    }

                    break;
                }
                case 'survey.deleted':
                    setGone('deleted');
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
