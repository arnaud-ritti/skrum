import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { PresenceMember } from '@/lib/retro/types';
import { useSafeConnectionStatus } from './use-retro-channel';

const SurveyEvents = [
    'survey.changed',
    'survey.responses.changed',
    'survey.deleted',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one resync cover both.
 */
const ResyncCoalesceMs = 250;

export type SurveyEventName = (typeof SurveyEvents)[number];

export type SurveyEvent = {
    name: SurveyEventName;
    payload: Record<string, unknown>;
};

type SurveyChannelHandlers = {
    onEvent: (event: SurveyEvent) => void;
    onResync: () => void;
};

/** A member open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

export function useSurveyChannel(
    surveyId: string,
    enabled: boolean,
    channelHandlers: SurveyChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const status = useSafeConnectionStatus();
    const handlers = useRef(channelHandlers);
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = channelHandlers;

    if (status === 'connected' && !wasConnected) {
        setWasConnected(true);
    }

    useEffect(() => {
        if (!enabled || !echoIsConfigured()) {
            return;
        }

        let pendingResync: ReturnType<typeof setTimeout> | null = null;

        const scheduleResync = () => {
            if (pendingResync !== null) {
                return;
            }

            pendingResync = setTimeout(() => {
                pendingResync = null;
                handlers.current.onResync();
            }, ResyncCoalesceMs);
        };

        const name = `survey.${surveyId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
            })
            .error(scheduleResync);

        for (const event of SurveyEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            setOnline([]);
        };
    }, [surveyId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting };
}
