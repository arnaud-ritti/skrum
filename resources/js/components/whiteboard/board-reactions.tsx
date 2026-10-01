import {
    avatarOrigin,
    FlyingReactions,
} from '@/components/realtime/flying-reactions';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { channelKey } from '@/lib/realtime/whisper-transport';

/**
 * Unmounted while the board's switch is off, so that incoming reactions are
 * dropped too. The bar is a sibling of the canvas container; the rules that
 * keep it and the canvas's own bottom controls apart are in app.css.
 */
export function BoardReactions({ state }: { state: WhiteboardState }) {
    const { snapshot, presence, online } = state;

    if (!presence || !snapshot.board.reactionsEnabled) {
        return null;
    }

    return (
        <FlyingReactions
            key={`${snapshot.board.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={snapshot.me.id}
            online={online}
            labelFor={(senderId) =>
                online.find((member) => member.id === senderId)?.name ??
                snapshot.members.find((member) => member.id === senderId)
                    ?.name ??
                null
            }
            originFor={avatarOrigin}
            toolbarProps={{ className: 'whiteboard-reactions' }}
        />
    );
}
