import { LiveCursors } from '@/components/session/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import { showsPokerCursors } from '@/lib/poker/room-adapters';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

/** Named pointers over the stage, between rounds only (see `showsPokerCursors`). */
export function RoomCursors({ container, hidden }: Props) {
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
