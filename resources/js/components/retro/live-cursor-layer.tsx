import { LiveCursors } from '@/components/session/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';

export { HideMyCursorKey } from '@/components/session/cursor-preference';

/**
 * During Voting a named pointer on a vote button would reveal who votes
 * where, so no cursor is sent or shown.
 */
const CursorlessPhases = ['voting', 'completed'];

export function showsCursors(retro: {
    cursorsEnabled: boolean;
    phase: string;
}): boolean {
    return retro.cursorsEnabled && !CursorlessPhases.includes(retro.phase);
}

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

export function LiveCursorLayer({ container, hidden }: Props) {
    const { board, presence, online } = useBoard();
    const { t } = useTrans();

    if (!presence || !showsCursors(board.retro)) {
        return null;
    }

    const labelFor = (senderId: string) =>
        board.retro.isAnonymous
            ? t('Participant')
            : (online.find((member) => member.id === senderId)?.name ??
              t('Participant'));

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
