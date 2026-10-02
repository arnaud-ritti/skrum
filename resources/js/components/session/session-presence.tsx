import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PresenceMember } from '@/lib/retro/types';

/** Below `sm` the mockups show the counter alone; above, the stack's own five avatars. */
const VisibleOnPhone = 0;

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

export type SessionPresenceProps = {
    online: PresenceMember[];
    selfId: string | null;
    facilitatorId?: string | null;
    presenceFor?: (member: PresenceMember) => number | undefined;
    className?: string;
};

export function SessionPresence({
    online,
    selfId,
    facilitatorId,
    presenceFor,
    className,
}: SessionPresenceProps) {
    const isMobile = useIsMobile();

    return (
        <PresenceStack
            participants={toParticipants(
                online,
                selfId,
                facilitatorId,
                presenceFor,
            )}
            max={isMobile ? VisibleOnPhone : undefined}
            className={className}
        />
    );
}
