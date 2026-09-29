import { tokenBucket, type TokenBucket } from 'live-reactions';
import { LiveReactions, useReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { isSingleEmoji, QuickEmoji } from '@/lib/retro/emoji';
import {
    channelKey,
    whisperTransport,
    type WhisperChannel,
} from '@/lib/retro/whisper-transport';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';
import { EmojiPicker } from './emoji-picker';

const ReceiveLimit = { burst: 5, perSecond: 2 };

export function FlyingReactions() {
    const { board, presence } = useBoard();

    if (
        !presence ||
        !board.retro.reactionsEnabled ||
        board.retro.phase === 'completed'
    ) {
        return null;
    }

    return (
        <Reactions
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
        />
    );
}

function Reactions({ presence }: { presence: WhisperChannel }) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());
    const buckets = useRef(new Map<string, TokenBucket>());
    const isAnonymous = useRef(board.retro.isAnonymous);

    isAnonymous.current = board.retro.isAnonymous;

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

    const [transport] = useState(() =>
        whisperTransport(presence, 'reaction', (senderId, raw) => {
            if (!roster.current.has(senderId)) {
                return false;
            }

            if (!isSingleEmoji((raw as { e?: unknown } | null)?.e)) {
                return false;
            }

            let bucket = buckets.current.get(senderId);

            if (!bucket) {
                bucket = tokenBucket(ReceiveLimit);
                buckets.current.set(senderId, bucket);
            }

            return bucket.take();
        }),
    );

    const { reactions, send } = useReactions({
        transport: () => transport,
        selfId: board.viewer.participantId,
        origin: (senderId) => originOf(senderId, isAnonymous.current),
    });

    const nameOf = (senderId: string) =>
        board.retro.isAnonymous
            ? null
            : online.find((member) => member.id === senderId)?.name;

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => nameOf(reaction.senderId)}
            />
            <div
                {...dragIsolation}
                role="toolbar"
                aria-label={t('Reactions')}
                className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg"
            >
                {QuickEmoji.map((emoji) => (
                    <Button
                        key={emoji}
                        size="icon"
                        variant="ghost"
                        className="size-9 text-lg"
                        aria-label={`${t('Send a reaction')} ${emoji}`}
                        onClick={() => send(emoji)}
                    >
                        {emoji}
                    </Button>
                ))}
                <EmojiPicker
                    label={t('Send a reaction')}
                    onPick={(emoji) => send(emoji)}
                >
                    <Button size="icon" variant="ghost" className="size-9">
                        <SmilePlus className="size-4" />
                    </Button>
                </EmojiPicker>
            </div>
        </>
    );
}

/**
 * On anonymous retros an avatar origin would reveal who reacted, so every
 * reaction rises from near the centre.
 */
function originOf(senderId: string, isAnonymous: boolean): number {
    const avatar = isAnonymous
        ? null
        : document.querySelector(
              `[data-presence-id="${CSS.escape(senderId)}"]`,
          );

    if (!avatar) {
        return 0.4 + Math.random() * 0.2;
    }

    const rect = avatar.getBoundingClientRect();
    const origin = (rect.left + rect.width / 2) / window.innerWidth;

    return Math.min(1, Math.max(0, origin));
}
