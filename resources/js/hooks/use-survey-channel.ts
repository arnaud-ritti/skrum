import { usePresenceChannel, type ChannelEvent } from './use-presence-channel';

const SurveyEvents = [
    'survey.changed',
    'survey.responses.changed',
    'survey.deleted',
] as const;

export type SurveyEvent = ChannelEvent<(typeof SurveyEvents)[number]>;

type SurveyChannelHandlers = {
    onEvent: (event: SurveyEvent) => void;
    onResync: () => void;
};

export function useSurveyChannel(
    surveyId: string,
    enabled: boolean,
    channelHandlers: SurveyChannelHandlers,
) {
    const { online, connected, reconnecting } = usePresenceChannel(
        `survey.${surveyId}`,
        SurveyEvents,
        enabled,
        channelHandlers,
    );

    return { online, connected, reconnecting };
}
