import { LiveCursors } from '@/components/session/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import type { PokerSnapshot } from '@/lib/poker/types';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

/**
 * The hand sits at a fixed place, so a named pointer over a card would give
 * away a hidden vote: no cursor is sent or shown while a round is open, nor
 * on an ended (read-only) game.
 */
export function showsPokerCursors(snapshot: PokerSnapshot): boolean {
    return (
        snapshot.game.cursorsEnabled &&
        snapshot.game.endedAt === null &&
        (snapshot.current === null ||
            snapshot.current.round.revealedAt !== null)
    );
}

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

export function GameCursors({ container, hidden }: Props) {
    const { snapshot, presence, online } = useGame();
    const { t } = useTrans();

    if (!presence || !showsPokerCursors(snapshot)) {
        return null;
    }

    const labelFor = (senderId: string) =>
        snapshot.players.find((player) => player.id === senderId)?.name ??
        online.find((member) => member.id === senderId)?.name ??
        t('Player');

    return (
        <LiveCursors
            key={`${snapshot.game.id}:${channelKey(presence)}`}
            presence={presence}
            container={container}
            hidden={hidden}
            selfId={snapshot.me.playerId}
            online={online}
            labelFor={labelFor}
        />
    );
}
