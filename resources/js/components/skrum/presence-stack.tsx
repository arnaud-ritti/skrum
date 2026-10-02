import { UserPlus, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence, AvatarSize } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export interface Participant {
    id: string;
    name: string;
    initials: string;
    presence: number;
    role: 'facilitator' | 'member' | 'guest';
    status: 'online' | 'away' | 'offline';
    typing?: boolean;
    isMe?: boolean;
    awayMinutes?: number;
}

export interface PresenceStackProps {
    participants: Participant[];
    max?: number;
    size?: 'sm' | 'md';
    onInvite?: () => void;
    className?: string;
}

const overflowSizeClasses: Record<'sm' | 'md', string> = {
    sm: 'size-6 text-overline tracking-normal',
    md: 'size-8 text-xs',
};

function toPresence(value: number): AvatarPresence | undefined {
    if (!Number.isInteger(value) || value < 1 || value > 12) {
        return undefined;
    }

    return value as AvatarPresence;
}

function listOrder(participant: Participant): number {
    if (participant.role === 'facilitator') {
        return 0;
    }

    if (participant.isMe) {
        return 1;
    }

    if (participant.role === 'guest') {
        return 5;
    }

    const statusOrder = { online: 2, away: 3, offline: 4 };

    return statusOrder[participant.status];
}

function sortForList(participants: Participant[]): Participant[] {
    return participants
        .map((participant, index) => ({ participant, index }))
        .sort(
            (a, b) =>
                listOrder(a.participant) - listOrder(b.participant) ||
                a.index - b.index,
        )
        .map(({ participant }) => participant);
}

function joinNames(names: string[]): string {
    const language =
        typeof document === 'undefined'
            ? 'en'
            : document.documentElement.lang || 'en';

    try {
        return new Intl.ListFormat(language, { type: 'conjunction' }).format(
            names,
        );
    } catch {
        return names.join(', ');
    }
}

function firstName(participant: Participant): string {
    if (participant.role === 'guest') {
        return participant.name;
    }

    return participant.name.split(' ')[0];
}

function ParticipantAvatar({
    participant,
    size,
    className,
}: {
    participant: Participant;
    size: AvatarSize;
    className?: string;
}) {
    const isGuest = participant.role === 'guest';

    return (
        <PersonAvatar
            data-presence-id={participant.id}
            name={participant.name}
            kind={isGuest ? 'guest' : 'member'}
            presence={toPresence(participant.presence)}
            size={size}
            status={
                participant.status === 'offline'
                    ? undefined
                    : participant.status
            }
            typing={
                Boolean(participant.typing) && participant.status !== 'offline'
            }
            className={cn(
                participant.status === 'offline' && 'opacity-55',
                className,
            )}
        />
    );
}

export function PresenceStack({
    participants,
    max = 5,
    size = 'md',
    onInvite,
    className,
}: PresenceStackProps) {
    const { t } = useTrans();
    const [initialIds] = useState(
        () => new Set(participants.map((participant) => participant.id)),
    );

    const connected = participants.filter(
        (participant) => participant.status !== 'offline',
    );
    const visible = connected.slice(0, Math.max(0, max));
    const hiddenCount = connected.length - visible.length;
    const typingNames = connected
        .filter((participant) => participant.typing)
        .map(firstName);
    const guestCount = participants.filter(
        (participant) => participant.role === 'guest',
    ).length;
    const listed = sortForList(participants);

    function statusText(participant: Participant): string {
        if (participant.status === 'offline') {
            return t('Disconnected');
        }

        if (participant.typing) {
            return t('Writing…');
        }

        if (participant.status === 'away') {
            return participant.awayMinutes === undefined
                ? t('Away')
                : t('Away for :minutes min', {
                      minutes: participant.awayMinutes,
                  });
        }

        return t('Online');
    }

    function roleText(participant: Participant): string {
        const labels = {
            facilitator: t('Facilitator'),
            member: t('Member'),
            guest: t('Anonymous guest'),
        };

        return labels[participant.role];
    }

    return (
        <div
            data-slot="presence-stack"
            className={cn(
                'inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1',
                className,
            )}
        >
            <Popover modal>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label={t(
                            ':count participants connected, view the list',
                            { count: connected.length },
                        )}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-body-sm font-semibold shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <span
                            data-slot="presence-stack-avatars"
                            className="flex items-center -space-x-2 *:rounded-full *:ring-2 *:ring-card"
                        >
                            {visible.map((participant) => (
                                <ParticipantAvatar
                                    key={participant.id}
                                    participant={participant}
                                    size={size}
                                    className={cn(
                                        !initialIds.has(participant.id) &&
                                            'duration-base animate-in ease-spring zoom-in-50 fade-in motion-reduce:animate-none',
                                    )}
                                />
                            ))}
                            {hiddenCount > 0 && (
                                <span
                                    data-slot="presence-stack-more"
                                    aria-hidden
                                    className={cn(
                                        'inline-flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground',
                                        overflowSizeClasses[size],
                                    )}
                                >
                                    +{hiddenCount}
                                </span>
                            )}
                        </span>
                        <span className="truncate">
                            {t(':count online', { count: connected.length })}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    aria-label={t('Participants')}
                    align="end"
                    sideOffset={8}
                    data-slot="presence-stack-popover"
                    className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-2 text-popover-foreground shadow-popover outline-hidden duration-(--duration-base) ease-(--ease-enter) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
                >
                    <div className="flex items-center justify-between px-2 pt-2 pb-1">
                        <span className="text-body-sm font-semibold">
                            {t('Participants')}
                        </span>
                        <Badge variant="secondary" shape="pill">
                            {t(':count online', {
                                count: connected.length,
                            })}
                        </Badge>
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                        {listed.map((participant) => (
                            <li
                                key={participant.id}
                                data-slot="presence-stack-item"
                                data-status={participant.status}
                                className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-body-sm"
                            >
                                <ParticipantAvatar
                                    participant={participant}
                                    size="md"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-semibold">
                                        {participant.isMe
                                            ? t(':name (you)', {
                                                  name: participant.name,
                                              })
                                            : participant.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {roleText(participant)}
                                        {' · '}
                                        {statusText(participant)}
                                    </span>
                                </span>
                                {participant.role === 'facilitator' && (
                                    <WandSparkles
                                        aria-hidden
                                        className="size-4 shrink-0 text-skrum-primary-text"
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                    {onInvite && (
                        <div className="mt-2 flex items-center justify-end border-t px-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onInvite}
                            >
                                <UserPlus aria-hidden />
                                <span className="truncate">{t('Invite')}</span>
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
            {guestCount > 0 && (
                <Badge variant="secondary" shape="pill">
                    {t(':count guests', { count: guestCount })}
                </Badge>
            )}
            <span
                data-slot="presence-stack-typing"
                aria-live="polite"
                className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground empty:hidden"
            >
                {typingNames.length > 0 && (
                    <>
                        <span aria-hidden className="flex items-center gap-px">
                            <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                            <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
                        </span>
                        <span className="truncate">
                            {typingNames.length === 1
                                ? t(':names is writing…', {
                                      names: typingNames[0],
                                  })
                                : t(':names are writing…', {
                                      names: joinNames(typingNames),
                                  })}
                        </span>
                    </>
                )}
            </span>
        </div>
    );
}
