import { useSyncExternalStore } from 'react';
import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import type { PresenceMember } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

/** Below `sm` the mockups show the counter alone; above, the stack's own five avatars. */
const VisibleOnPhone = 0;
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
    presenceFor?: (member: PresenceMember) => number | undefined,
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
        presence: presenceFor?.(member),
    }));
}

type SessionPresenceProps = {
    online: PresenceMember[];
    selfId: string | null;
    facilitatorId?: string | null;
    presenceFor?: (member: PresenceMember) => number | undefined;
    /** Rings the member's avatar and names them on the typing line. */
    typingFor?: (member: PresenceMember) => boolean;
    /** How many write when nobody may be named (an anonymous retro). */
    typingCount?: number;
    className?: string;
};

export function SessionPresence({
    online,
    selfId,
    facilitatorId,
    presenceFor,
    typingFor,
    typingCount,
    className,
}: SessionPresenceProps) {
    const isBelowSm = useIsBelowSm();
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
            max={isBelowSm ? VisibleOnPhone : undefined}
            className={cn(
                'max-sm:[&_[data-slot=presence-stack-guests]]:hidden',
                className,
            )}
        />
    );
}
