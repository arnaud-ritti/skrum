import { useSyncExternalStore } from 'react';
import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import { useIsNarrowerThan } from '@/hooks/use-is-narrower-than';
import { presenceOf } from '@/lib/presence/presence-color';
import type { PresenceMember } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

/** Below this width, in rem, a session header shows the counter alone; above, the stack's own five avatars. */
const AvatarsFrom = 64;
const VisibleOnPhone = 0;
/** A screen that asks for small avatars on a phone keeps the full stack down to `sm`. */
const BelowSm = '(max-width: 639px)';

function subscribeToBelowSm(onChange: () => void): () => void {
    const query = window.matchMedia(BelowSm);

    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
}

function useIsBelowSm(): boolean {
    return useSyncExternalStore(
        subscribeToBelowSm,
        () => window.matchMedia(BelowSm).matches,
        () => false,
    );
}

export function toParticipants(
    online: PresenceMember[],
    selfId: string | null,
    facilitatorId?: string | null,
    presenceFor: (member: PresenceMember) => number = presenceOf,
): Participant[] {
    return online.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
        role:
            member.id === facilitatorId
                ? 'facilitator'
                : member.isGuest
                  ? 'guest'
                  : 'member',
        status: 'online',
        isMe: member.id === selfId,
        presence: presenceFor(member),
    }));
}

type SessionPresenceProps = {
    online: PresenceMember[];
    selfId: string | null;
    facilitatorId?: string | null;
    /** The colour of each avatar; by default the one the server sent. */
    presenceFor?: (member: PresenceMember) => number;
    /** Rings the member's avatar and names them on the typing line. */
    typingFor?: (member: PresenceMember) => boolean;
    /** How many write when nobody may be named (an anonymous retro). */
    typingCount?: number;
    /** Below `sm`, the small avatars shown before +N; by default none, and the counter alone below 64rem. */
    phoneAvatars?: number;
    className?: string;
};

export function SessionPresence({
    online,
    selfId,
    facilitatorId,
    presenceFor,
    typingFor,
    typingCount,
    phoneAvatars = VisibleOnPhone,
    className,
}: SessionPresenceProps) {
    const isBelowSm = useIsBelowSm();
    const hasNoRoomForAvatars = useIsNarrowerThan(AvatarsFrom);
    const isShort = phoneAvatars > 0 ? isBelowSm : hasNoRoomForAvatars;
    const participants = toParticipants(
        online,
        selfId,
        facilitatorId,
        presenceFor,
    ).map((participant, index) =>
        typingFor?.(online[index])
            ? { ...participant, typing: true }
            : participant,
    );

    return (
        <PresenceStack
            participants={participants}
            typingCount={typingCount}
            folds
            max={isShort ? phoneAvatars : undefined}
            size={isShort && phoneAvatars > 0 ? 'sm' : undefined}
            className={cn(
                phoneAvatars > 0 &&
                    'max-sm:[&_[data-slot=presence-stack-count]]:sr-only',
                className,
            )}
        />
    );
}
