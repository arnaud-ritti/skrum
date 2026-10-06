import { SessionReactions } from '@/components/session/session-reactions';
import { avatarOrigin } from '@/components/session/use-flying-reactions';
import { useIsMobile } from '@/hooks/use-mobile';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { channelKey } from '@/lib/realtime/whisper-transport';

/**
 * Unmounted while the board's switch is off, so that incoming reactions are
 * dropped too. The bar follows the canvas container as a sibling; the rules
 * that keep it and the canvas's own bottom controls apart are in app.css.
 * Digits pick the canvas's tools, so the bar has no digit shortcuts.
 */
export function BoardReactions({ state }: { state: WhiteboardState }) {
    const { snapshot, presence, online } = state;
    const isMobile = useIsMobile();

    if (!presence || !snapshot.board.reactionsEnabled) {
        return null;
    }

    return (
        <SessionReactions
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
            shortcuts={false}
            compact={isMobile}
            toolbarProps={{ className: 'whiteboard-reactions' }}
            emojiData={snapshot.emojiData}
        />
    );
}
