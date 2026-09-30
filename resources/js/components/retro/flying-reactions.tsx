import {
    avatarOrigin,
    centreOrigin,
    FlyingReactions as SharedFlyingReactions,
} from '@/components/realtime/flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

export function FlyingReactions() {
    const { board, presence, online } = useBoard();

    if (
        !presence ||
        !board.retro.reactionsEnabled ||
        board.retro.phase === 'completed'
    ) {
        return null;
    }

    const isAnonymous = board.retro.isAnonymous;

    return (
        <SharedFlyingReactions
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={board.viewer.participantId}
            online={online}
            labelFor={(senderId) =>
                isAnonymous
                    ? null
                    : (online.find((member) => member.id === senderId)?.name ??
                      null)
            }
            originFor={(senderId) =>
                isAnonymous ? centreOrigin() : avatarOrigin(senderId)
            }
            toolbarProps={dragIsolation}
        />
    );
}
