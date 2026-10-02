import { tokenBucket, type TokenBucket } from 'live-reactions';
import { useReactions } from 'live-reactions/react';
import { useEffect, useRef, useState } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import { isSingleEmoji } from '@/lib/retro/emoji';
import type { PresenceMember } from '@/lib/retro/types';

const ReceiveLimit = { burst: 5, perSecond: 2 };

export function centreOrigin(): number {
    return 0.4 + Math.random() * 0.2;
}

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

export type FlyingReactionsOptions = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    originFor: (senderId: string) => number;
};

export function useFlyingReactions({
    presence,
    selfId,
    online,
    originFor,
}: FlyingReactionsOptions) {
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

    return useReactions({
        transport: () => transport,
        selfId,
        origin: (senderId) => origin.current(senderId),
    });
}
