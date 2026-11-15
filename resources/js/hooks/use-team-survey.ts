import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { RetroRequestError } from '@/lib/retro/api';
import { surveyApi } from '@/lib/surveys/api';
import { surveyReducer } from '@/lib/surveys/survey-reducer';
import type { SurveyAction } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot, SurveyStatus } from '@/lib/surveys/types';
import { useSurveyChannel } from './use-survey-channel';

const RefetchDelayMs = 1000;

const SessionExpiredStatuses = [401, 419];

export type SurveyGoneReason = 'deleted' | 'ended';

export function useTeamSurvey(initial: SurveySnapshot) {
    const [snapshot, apply] = useReducer(surveyReducer, initial);
    const [gone, setGone] = useState<SurveyGoneReason | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(snapshot);
    const latestRefetch = useRef(0);
    const localChanges = useRef(0);

    /** Counts the edits made here, so a refetch sent before one of them can tell its answer is stale. */
    const dispatch = useCallback((action: SurveyAction): void => {
        if (action.type !== 'snapshot.replace') {
            localChanges.current += 1;
        }

        apply(action);
    }, []);

    useEffect(() => {
        latest.current = snapshot;
    });

    /**
     * Resolves true once the server's snapshot replaced the local one. An
     * answer to a request sent before a local edit predates it (an added
     * question would vanish), so it is dropped and the snapshot asked again.
     */
    const refetch = useCallback(async (): Promise<boolean> => {
        const request = ++latestRefetch.current;
        const changes = localChanges.current;

        try {
            const fresh = await surveyApi.snapshot(initial.survey.id);

            if (request !== latestRefetch.current) {
                return false;
            }

            if (changes !== localChanges.current) {
                return refetch();
            }

            apply({ type: 'snapshot.replace', snapshot: fresh });

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

                    apply({ type: 'progress.set', ...payload });

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
