import { tokenBucket, type TokenBucket } from 'live-reactions';
import { LiveReactions, useReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import { isSingleEmoji, QuickEmoji } from '@/lib/retro/emoji';
import type { PresenceMember } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

const ReceiveLimit = { burst: 5, perSecond: 2 };

type Props = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string | null;
    originFor: (senderId: string) => number;
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
};

export function centreOrigin(): number {
    return 0.4 + Math.random() * 0.2;
}

/** Rises from above the sender's avatar in the presence strip, else near the centre. */
export function avatarOrigin(senderId: string): number {
    const avatar = document.querySelector(
        `[data-presence-id="${CSS.escape(senderId)}"]`,
    );

    if (!avatar) {
        return centreOrigin();
    }

    const rect = avatar.getBoundingClientRect();
    const origin = (rect.left + rect.width / 2) / window.innerWidth;

    return Math.min(1, Math.max(0, origin));
}

/**
 * Board-agnostic reactions bar and flying layer. Callers mount it only when
 * reactions are allowed and key it by the channel.
 */
export function FlyingReactions({
    presence,
    selfId,
    online,
    labelFor,
    originFor,
    toolbarProps,
}: Props) {
    const { t } = useTrans();
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());
    const buckets = useRef(new Map<string, TokenBucket>());
    const origin = useRef(originFor);

    origin.current = originFor;

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
        selfId,
        origin: (senderId) => origin.current(senderId),
    });

    const { className, ...restToolbarProps } = toolbarProps ?? {};

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => labelFor(reaction.senderId)}
            />
            <div
                {...restToolbarProps}
                role="toolbar"
                aria-label={t('Reactions')}
                className={cn(
                    'fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg',
                    className,
                )}
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
