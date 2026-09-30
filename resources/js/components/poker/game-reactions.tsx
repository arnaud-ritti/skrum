import {
    avatarOrigin,
    FlyingReactions,
} from '@/components/realtime/flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

/** Allowed in every round state: an emoji carries no card value. */
export function GameReactions() {
    const { snapshot, presence, online } = useGame();

    if (
        !presence ||
        !snapshot.game.reactionsEnabled ||
        snapshot.game.endedAt !== null
    ) {
        return null;
    }

    return (
        <FlyingReactions
            key={`${snapshot.game.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={snapshot.me.playerId}
            online={online}
            labelFor={(senderId) =>
                snapshot.players.find((player) => player.id === senderId)
                    ?.name ?? null
            }
            originFor={avatarOrigin}
            toolbarProps={{ className: 'bottom-28' }}
        />
    );
}
