import { SessionReactions } from '@/components/session/session-reactions';
import {
    avatarOrigin,
    centreOrigin,
} from '@/components/session/use-flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

/** Flying reactions follow the setting, session end included (spec §9.1). */
export function showsRetroReactions(retro: {
    reactionsEnabled: boolean;
}): boolean {
    return retro.reactionsEnabled;
}

type Props = {
    /** `inline` when the facilitator dock stacks the bar above its own. */
    variant?: 'floating' | 'inline';
    compact?: boolean;
    /** In rem: what the bar must clear at the bottom of the screen. */
    offsetBottom?: number;
};

export function BoardReactions({
    variant = 'floating',
    compact,
    offsetBottom,
}: Props) {
    const { board, presence, online } = useBoard();

    if (!presence || !showsRetroReactions(board.retro)) {
        return null;
    }

    const isAnonymous = board.retro.isAnonymous;

    return (
        <SessionReactions
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={board.viewer.participantId}
            online={online}
            variant={variant}
            compact={compact}
            offsetBottom={offsetBottom}
            emojiData={board.emojiData}
            labelFor={(senderId) =>
                isAnonymous
                    ? null
                    : (online.find((member) => member.id === senderId)?.name ??
                      null)
            }
            originFor={isAnonymous ? centreOrigin : avatarOrigin}
            toolbarProps={dragIsolation}
        />
    );
}
