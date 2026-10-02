import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type PlayerRowProps = {
    name: string;
    /** null for a player who left the room: no avatar. */
    avatarUrl: string | null;
    isGuest: boolean;
    isMe?: boolean;
    isHost?: boolean;
    /** Whose turn it is: the drawer, the clue giver. */
    isTurn?: boolean;
    offline?: boolean;
    /** A position, or an icon in its place (the crown of the first). */
    rank?: ReactNode;
    /** Second line under the name. */
    detail?: ReactNode;
    /** Right end of the row: points, marks. */
    trailing?: ReactNode;
    className?: string;
};

export function PlayerRow({
    name,
    avatarUrl,
    isGuest,
    isMe = false,
    isHost = false,
    isTurn = false,
    offline = false,
    rank,
    detail,
    trailing,
    className,
}: PlayerRowProps) {
    const { t } = useTrans();

    return (
        <li
            data-slot="player-row"
            data-me={isMe || undefined}
            data-turn={isTurn || undefined}
            data-offline={offline || undefined}
            className={cn(
                'flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2',
                isMe && 'bg-accent',
                isTurn &&
                    'bg-skrum-primary-soft ring-1 ring-primary ring-inset',
                offline && 'opacity-55',
                className,
            )}
        >
            {rank !== undefined && (
                <span
                    data-slot="player-rank"
                    className="grid w-4.5 shrink-0 place-items-center text-xs font-bold text-muted-foreground tabular-nums"
                >
                    {rank}
                </span>
            )}
            {avatarUrl !== null && (
                <PersonAvatar
                    name={name}
                    src={avatarUrl}
                    kind={isGuest ? 'guest' : 'member'}
                    size="sm"
                    decorative
                />
            )}
            <span
                data-slot="player-name"
                className="flex min-w-0 flex-1 flex-col text-body-sm font-semibold"
            >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                    <span className="truncate">{name}</span>
                    {isGuest && (
                        <span className="shrink-0 font-medium text-muted-foreground">
                            {t('(guest)')}
                        </span>
                    )}
                    {isMe && (
                        <span className="shrink-0 font-medium text-muted-foreground">
                            {t('(you)')}
                        </span>
                    )}
                    {isHost && (
                        <Badge
                            variant="muted"
                            className="min-h-4.5 shrink-0 self-center px-1.5"
                        >
                            {t('Host')}
                        </Badge>
                    )}
                </span>
                {detail !== undefined && (
                    <span className="truncate text-xs font-medium text-muted-foreground">
                        {detail}
                    </span>
                )}
            </span>
            {trailing}
        </li>
    );
}

export function PlayerPoints({ points }: { points: number }) {
    const { t } = useTrans();

    return (
        <span
            data-slot="player-points"
            className="shrink-0 font-mono font-semibold whitespace-nowrap tabular-nums"
            aria-label={t(':count points', { count: points })}
        >
            {points}
        </span>
    );
}
