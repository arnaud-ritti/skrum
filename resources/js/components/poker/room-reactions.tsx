import { SessionReactions } from '@/components/session/session-reactions';
import { avatarOrigin } from '@/components/session/use-flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

/**
 * The reaction bar of the dock, in flow above the deck. Allowed in every
 * round state, for a watcher too: an emoji carries no card value.
 */
export function RoomReactions({ compact }: { compact: boolean }) {
    const { snapshot, presence, online } = useGame();

    if (
        !presence ||
        !snapshot.game.reactionsEnabled ||
        snapshot.game.endedAt !== null
    ) {
        return null;
    }

    return (
        <SessionReactions
            key={`${snapshot.game.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={snapshot.me.playerId}
            online={online}
            labelFor={(senderId) =>
                snapshot.players.find((player) => player.id === senderId)
                    ?.name ?? null
            }
            originFor={avatarOrigin}
            variant="inline"
            compact={compact}
            emojiData={snapshot.emojiData}
        />
    );
}
