import { LiveCursors } from '@/components/session/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import { activityLabel } from '@/lib/retro/activity';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';

/**
 * During Voting a named pointer on a vote button would reveal who votes
 * where, and during ROTI who gives which score: no cursor is sent or shown.
 */
const CursorlessPhases = ['voting', 'roti', 'completed'];

export function showsRetroCursors(retro: {
    cursorsEnabled: boolean;
    phase: string;
}): boolean {
    return retro.cursorsEnabled && !CursorlessPhases.includes(retro.phase);
}

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

export function BoardCursors({ container, hidden }: Props) {
    const { board, presence, online } = useBoard();
    const { t } = useTrans();

    if (!presence || !showsRetroCursors(board.retro)) {
        return null;
    }

    const labelFor = (senderId: string) =>
        activityLabel(
            online.find((member) => member.id === senderId),
            board.retro.isAnonymous,
            t,
        );

    return (
        <LiveCursors
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
            container={container}
            hidden={hidden}
            selfId={board.viewer.participantId}
            online={online}
            labelFor={labelFor}
        />
    );
}
