import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    ArrowLeft,
    Brush,
    ChevronRight,
    Clock,
    CloudSun,
    Crown,
    Film,
    Flame,
    Gamepad2,
    Globe,
    MessageCircleQuestion,
    Plus,
    Smile,
    Trophy,
    UserRoundSearch,
    Users,
    VenetianMask,
    WholeWord,
    CircleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { cn } from '@/lib/utils';

export type { GameKind };
export type GameRoomAccess = 'team' | 'link';
export type GameRoomStatus = 'live' | 'waiting' | 'finished';
export type GameLeaderboardPeriod = '30d' | 'all';

const LeaderboardPeriods: GameLeaderboardPeriod[] = ['30d', 'all'];

export type GameRoomPlayer = {
    name: string;
    avatarUrl?: string | null;
    presence?: AvatarPresence;
};

export type GamesRoom = {
    id: string;
    name: string | null;
    game: GameKind;
    access: GameRoomAccess;
    playersCount: number;
    roundsCount: number;
    href: NonNullable<InertiaLinkProps['href']>;
    status?: GameRoomStatus;
    minPlayers?: number;
    players?: GameRoomPlayer[];
    /** Replaces the rounds count beside the game, e.g. "started 4 min ago". */
    context?: string;
};

export type GameOption = { value: GameKind; label: string; available: boolean };

export type NewGameRoomValues = {
    name: string;
    game: GameKind;
    access: GameRoomAccess;
};

export type NewGameRoomErrors = Partial<
    Record<keyof NewGameRoomValues, string>
>;

export type GamesLeaderboardEntry = {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    presence?: AvatarPresence;
    points: number;
    wins: number;
    roundsPlayed: number;
    streak?: number;
};

type GameStyle = { icon: LucideIcon; tile: string };

/** The picker's colours, so a game has one colour everywhere (P27-03). */
const gameStyles: Record<GameKind, GameStyle> = {
    hangman: {
        icon: WholeWord,
        tile: 'bg-skrum-col-coral border-skrum-col-coral-border text-skrum-col-coral-text',
    },
    decoded: {
        icon: Smile,
        tile: 'bg-skrum-col-sun border-skrum-col-sun-border text-skrum-col-sun-text',
    },
    draw: {
        icon: Brush,
        tile: 'bg-skrum-col-iris border-skrum-col-iris-border text-skrum-col-iris-text',
    },
    gif: {
        icon: Film,
        tile: 'bg-skrum-col-apricot border-skrum-col-apricot-border text-skrum-col-apricot-text',
    },
    two_truths: {
        icon: VenetianMask,
        tile: 'bg-skrum-col-plum border-skrum-col-plum-border text-skrum-col-plum-text',
    },
    mood: {
        icon: CloudSun,
        tile: 'bg-skrum-col-sky border-skrum-col-sky-border text-skrum-col-sky-text',
    },
    guess_who: {
        icon: UserRoundSearch,
        tile: 'bg-skrum-col-moss border-skrum-col-moss-border text-skrum-col-moss-text',
    },
    quick_question: {
        icon: MessageCircleQuestion,
        tile: 'bg-skrum-col-lagoon border-skrum-col-lagoon-border text-skrum-col-lagoon-text',
    },
};

const statusOrder: Record<GameRoomStatus, number> = {
    live: 0,
    waiting: 1,
    finished: 2,
};

const StreakBadgeFrom = 2;
const NameMaxLength = 60;

function useGameLabel(): (game: GameKind) => string {
    const { t } = useTrans();

    return (game) => {
        switch (game) {
            case 'hangman':
                return t('Hangman');
            case 'draw':
                return t('Draw & Guess');
            case 'gif':
                return t('Sprint in one GIF');
            case 'decoded':
                return t('Decoded');
            case 'two_truths':
                return t('Two truths and a lie');
            case 'mood':
                return t('Mood weather');
            case 'guess_who':
                return t('Guess who?');
            case 'quick_question':
                return t('Quick question');
        }
    };
}

function useCounts() {
    const { t } = useTrans();

    return {
        players: (count: number) =>
            count === 1
                ? t(':count player', { count })
                : t(':count players', { count }),
        rounds: (count: number) =>
            count === 1
                ? t(':count round', { count })
                : t(':count rounds', { count }),
        wins: (count: number) =>
            count === 1
                ? t(':count win', { count })
                : t(':count wins', { count }),
    };
}

function formatNumber(value: number): string {
    const locale =
        typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined;

    return new Intl.NumberFormat(locale).format(value);
}

export type NewGameRoomIds = { name: string; game: string; access: string };

/** The ids existing pages and the browser suite bind to. */
const DefaultNewGameRoomIds: NewGameRoomIds = {
    name: 'new-room-name',
    game: 'new-room-game',
    access: 'new-room-access',
};

function FieldError({ id, error }: { id: string; error?: string }) {
    if (!error) {
        return null;
    }

    return (
        <p
            id={id}
            role="alert"
            data-slot="field-error"
            className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
        >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{error}</span>
        </p>
    );
}

export type NewGameRoomDialogProps = {
    gameOptions: GameOption[];
    /** Control ids; each defaults to the id of the existing dialog. */
    ids?: Partial<NewGameRoomIds>;
    onCreate: (
        values: NewGameRoomValues,
    ) => boolean | void | Promise<boolean | void>;
    errors?: NewGameRoomErrors;
    processing?: boolean;
    variant?: 'default' | 'outline';
    className?: string;
};

function NewGameRoomDialog({
    gameOptions,
    ids,
    onCreate,
    errors,
    processing = false,
    variant = 'default',
    className,
}: NewGameRoomDialogProps) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant={variant}
                    className={cn('max-w-full', className)}
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('New room')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent size="sm" aria-describedby={undefined}>
                {open && (
                    <NewGameRoomForm
                        gameOptions={gameOptions}
                        fieldIds={{ ...DefaultNewGameRoomIds, ...ids }}
                        errors={errors}
                        processing={processing}
                        onCancel={() => setOpen(false)}
                        onSubmit={async (values) => {
                            const result = await onCreate(values);

                            if (result !== false) {
                                setOpen(false);
                            }
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function NewGameRoomForm({
    gameOptions,
    fieldIds,
    errors,
    processing,
    onCancel,
    onSubmit,
}: {
    gameOptions: GameOption[];
    fieldIds: NewGameRoomIds;
    errors?: NewGameRoomErrors;
    processing: boolean;
    onCancel: () => void;
    onSubmit: (values: NewGameRoomValues) => void;
}) {
    const { t } = useTrans();
    const available = gameOptions.filter((option) => option.available);
    const [name, setName] = useState('');
    const [game, setGame] = useState<GameKind | ''>(available[0]?.value ?? '');
    const [access, setAccess] = useState<GameRoomAccess>('team');
    const [submitted, setSubmitted] = useState(false);
    const shownErrors = submitted ? errors : undefined;

    function submit(event: FormEvent): void {
        event.preventDefault();

        if (game === '' || name.trim() === '') {
            return;
        }

        setSubmitted(true);
        onSubmit({ name: name.trim(), game, access });
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader className="pr-8">
                <DialogTitle>{t('New room')}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-2">
                <Label htmlFor={fieldIds.name}>{t('Name')}</Label>
                <Input
                    id={fieldIds.name}
                    value={name}
                    maxLength={NameMaxLength}
                    required
                    autoFocus
                    aria-invalid={shownErrors?.name ? true : undefined}
                    aria-describedby={
                        shownErrors?.name ? `${fieldIds.name}-error` : undefined
                    }
                    onChange={(event) => setName(event.target.value)}
                />
                <FieldError
                    id={`${fieldIds.name}-error`}
                    error={shownErrors?.name}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={fieldIds.game}>{t('First game')}</Label>
                {available.length === 0 ? (
                    <p
                        data-slot="no-game-available"
                        className="text-sm text-muted-foreground"
                    >
                        {t('No game can be played here right now.')}
                    </p>
                ) : (
                    <Select
                        value={game}
                        onValueChange={(value) => setGame(value as GameKind)}
                    >
                        <SelectTrigger
                            id={fieldIds.game}
                            aria-invalid={shownErrors?.game ? true : undefined}
                            aria-describedby={
                                shownErrors?.game
                                    ? `${fieldIds.game}-error`
                                    : undefined
                            }
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {available.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <FieldError
                    id={`${fieldIds.game}-error`}
                    error={shownErrors?.game}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={fieldIds.access}>{t('Who can join')}</Label>
                <Select
                    value={access}
                    onValueChange={(value) =>
                        setAccess(value as GameRoomAccess)
                    }
                >
                    <SelectTrigger
                        id={fieldIds.access}
                        aria-invalid={shownErrors?.access ? true : undefined}
                        aria-describedby={
                            shownErrors?.access
                                ? `${fieldIds.access}-error`
                                : undefined
                        }
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="team">
                            {t('Team members only')}
                        </SelectItem>
                        <SelectItem value="link">
                            {t('Anyone with the link')}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <FieldError
                    id={`${fieldIds.access}-error`}
                    error={shownErrors?.access}
                />
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    <span className="truncate">{t('Cancel')}</span>
                </Button>
                <Button
                    type="submit"
                    disabled={processing || game === '' || name.trim() === ''}
                >
                    <span className="truncate">{t('Create room')}</span>
                </Button>
            </DialogFooter>
        </form>
    );
}

function StatusBadge({ room }: { room: GamesRoom }) {
    const { t } = useTrans();

    if (room.status === 'live') {
        return (
            <Badge variant="success" shape="pill" data-status="live">
                <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full bg-current"
                />
                <span className="truncate">{t('Live')}</span>
            </Badge>
        );
    }

    if (room.status === 'waiting') {
        return (
            <Badge
                variant="warning"
                shape="pill"
                icon={Clock}
                data-status="waiting"
            >
                <span className="truncate">{t('Waiting for players')}</span>
            </Badge>
        );
    }

    if (room.status === 'finished') {
        return (
            <Badge variant="muted" shape="pill" data-status="finished">
                <span className="truncate">{t('Finished')}</span>
            </Badge>
        );
    }

    return null;
}

function statusText(
    status: GameRoomStatus | undefined,
    t: (key: string) => string,
): string {
    if (status === 'live') {
        return t('Live');
    }

    if (status === 'waiting') {
        return t('Waiting for players');
    }

    if (status === 'finished') {
        return t('Finished');
    }

    return '';
}

function RoomRow({ room, action }: { room: GamesRoom; action?: ReactNode }) {
    const { t } = useTrans();
    const gameLabel = useGameLabel()(room.game);
    const counts = useCounts();
    const style = gameStyles[room.game];
    const Icon = style.icon;
    const title = room.name ?? gameLabel;
    const missing =
        room.status === 'waiting' && room.minPlayers !== undefined
            ? Math.max(0, room.minPlayers - room.playersCount)
            : 0;
    const AccessIcon = room.access === 'link' ? Globe : Users;
    const accessLabel =
        room.access === 'link' ? t('Open by link') : t('Team only');
    const rounds = counts.rounds(room.roundsCount);
    const context =
        missing > 0
            ? missing === 1
                ? t('needs 1 more player')
                : t('needs :count more players', { count: missing })
            : (room.context ?? rounds);
    const detailsId = useId();
    const label = [
        title,
        room.name === null ? '' : gameLabel,
        statusText(room.status, t),
        counts.players(room.playersCount),
    ]
        .filter((part) => part !== '')
        .join(', ');

    return (
        <li data-slot="game-room" className="flex items-center gap-2">
            <Link
                href={room.href}
                aria-label={label}
                aria-describedby={`${detailsId}-context ${detailsId}-rounds ${detailsId}-access`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-card p-3 transition-shadow duration-140 ease-standard outline-none hover:border-primary/35 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
                <span
                    aria-hidden
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center self-start rounded-md border',
                        style.tile,
                    )}
                >
                    <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-foreground">
                        {title}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{gameLabel}</span>
                        <span aria-hidden>·</span>
                        <span id={`${detailsId}-context`} className="truncate">
                            {context}
                        </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        {room.players && room.players.length > 0 && (
                            <AvatarStack
                                size="xs"
                                max={3}
                                total={room.playersCount}
                                people={room.players.map((player) => ({
                                    name: player.name,
                                    src: player.avatarUrl,
                                    presence: player.presence,
                                }))}
                            />
                        )}
                        <span className="text-xs text-muted-foreground">
                            {counts.players(room.playersCount)}
                        </span>
                        {context !== rounds && (
                            <span
                                id={`${detailsId}-rounds`}
                                data-slot="game-room-rounds"
                                className="text-xs text-muted-foreground"
                            >
                                {rounds}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <AccessIcon className="size-3.5" aria-hidden />
                            <span
                                id={`${detailsId}-access`}
                                className="truncate"
                            >
                                {accessLabel}
                            </span>
                        </span>
                        <StatusBadge room={room} />
                    </span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
            </Link>
            {action}
        </li>
    );
}

export type GameRoomListProps = {
    rooms: GamesRoom[];
    roomAction?: (room: GamesRoom) => ReactNode;
    className?: string;
};

export function GameRoomList({
    rooms,
    roomAction,
    className,
}: GameRoomListProps) {
    const sorted = rooms
        .map((room, index) => ({ room, index }))
        .sort(
            (first, second) =>
                (first.room.status ? statusOrder[first.room.status] : 0) -
                    (second.room.status
                        ? statusOrder[second.room.status]
                        : 0) || first.index - second.index,
        )
        .map(({ room }) => room);

    return (
        <ul
            data-slot="game-room-list"
            className={cn(
                'relative flex flex-col gap-2 p-1 lg:max-h-120 lg:overflow-y-auto',
                className,
            )}
        >
            {sorted.map((room) => (
                <RoomRow
                    key={room.id}
                    room={room}
                    action={roomAction?.(room)}
                />
            ))}
        </ul>
    );
}

function EmptyBlock({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div
            data-slot="games-empty"
            className="flex flex-col items-center gap-3 px-4 py-8 text-center"
        >
            <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
                <Icon className="size-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description && (
                <p className="max-w-sm text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

export type LeaderboardProps = {
    period: GameLeaderboardPeriod;
    onPeriodChange: (period: GameLeaderboardPeriod) => void;
    entries?: GamesLeaderboardEntry[];
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    currentUserId?: string;
    className?: string;
};

const podiumSlots = [
    { place: 1, order: 'order-2', step: 'h-20' },
    { place: 2, order: 'order-1', step: 'h-14' },
    { place: 3, order: 'order-3', step: 'h-10' },
] as const;

function PodiumPlace({
    place,
    order,
    step,
    entry,
    isMe,
}: {
    place: number;
    order: string;
    step: string;
    entry?: GamesLeaderboardEntry;
    isMe: boolean;
}) {
    const { t } = useTrans();

    if (!entry) {
        return (
            <li
                aria-hidden
                data-slot="podium-empty"
                className={cn('flex flex-col justify-end', order)}
            >
                <div
                    className={cn(
                        'rounded-t-md border border-dashed border-input',
                        step,
                    )}
                />
            </li>
        );
    }

    return (
        <li
            data-slot="podium-place"
            data-place={place}
            data-me={isMe || undefined}
            className={cn('flex min-w-0 flex-col items-center gap-1', order)}
        >
            <div className="flex w-full min-w-0 flex-col items-center gap-1 px-1 text-center">
                {place === 1 && (
                    <Crown
                        aria-hidden
                        className="size-5 text-skrum-warning"
                        data-slot="podium-crown"
                    />
                )}
                <PersonAvatar
                    name={entry.name}
                    src={entry.avatarUrl}
                    presence={entry.presence}
                    size="lg"
                    decorative
                    className={cn(isMe && 'ring-2 ring-ring ring-offset-2')}
                />
                <span className="max-w-full truncate text-sm font-semibold">
                    {entry.name}
                    {isMe && <span className="sr-only"> ({t('you')})</span>}
                </span>
                <span
                    data-slot="podium-points"
                    className={cn(
                        'text-xs font-semibold whitespace-nowrap tabular-nums',
                        place === 1
                            ? 'text-skrum-primary-text'
                            : 'text-muted-foreground',
                    )}
                >
                    {formatNumber(entry.points)} {t('pts')}
                </span>
                {(entry.streak ?? 0) >= StreakBadgeFrom && (
                    <Badge
                        variant="outline"
                        icon={Flame}
                        className="max-w-full"
                    >
                        <span className="truncate">
                            {t(':count-week streak', {
                                count: entry.streak ?? 0,
                            })}
                        </span>
                    </Badge>
                )}
            </div>
            <div
                className={cn(
                    'flex w-full items-start justify-center rounded-t-md border border-b-0 pt-2 font-display text-xl font-bold',
                    step,
                    place === 1
                        ? 'border-primary/35 bg-skrum-primary-soft text-skrum-primary-text'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                <span className="sr-only">{t('Place')} </span>
                {place}
            </div>
        </li>
    );
}

function LeaderboardBody({
    entries,
    currentUserId,
}: {
    entries: GamesLeaderboardEntry[];
    currentUserId?: string;
}) {
    const { t } = useTrans();
    const counts = useCounts();
    const isMe = (entry: GamesLeaderboardEntry): boolean =>
        currentUserId !== undefined && entry.userId === currentUserId;
    const rest = entries.slice(3);

    return (
        <div className="flex min-h-0 flex-col gap-4">
            <ol
                data-slot="podium"
                aria-label={t('Podium')}
                className="grid grid-cols-3 items-end gap-2"
            >
                {podiumSlots.map((slot) => (
                    <PodiumPlace
                        key={slot.place}
                        {...slot}
                        entry={entries[slot.place - 1]}
                        isMe={
                            entries[slot.place - 1] !== undefined &&
                            isMe(entries[slot.place - 1])
                        }
                    />
                ))}
            </ol>
            {rest.length > 0 && (
                <ol
                    start={4}
                    data-slot="leaderboard-list"
                    className="relative flex max-h-80 flex-col divide-y overflow-y-auto border-t"
                >
                    {rest.map((entry, index) => {
                        const me = isMe(entry);

                        return (
                            <li
                                key={entry.userId}
                                data-slot="leaderboard-row"
                                data-me={me || undefined}
                                className={cn(
                                    'flex items-center gap-3 p-2 text-sm',
                                    me && 'rounded-md bg-accent',
                                )}
                            >
                                <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
                                    {index + 4}
                                </span>
                                <PersonAvatar
                                    name={entry.name}
                                    src={entry.avatarUrl}
                                    presence={entry.presence}
                                    size="sm"
                                    decorative
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-semibold">
                                        {entry.name}
                                        {me && (
                                            <span className="sr-only">
                                                {' '}
                                                ({t('you')})
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="truncate text-xs text-muted-foreground">
                                            {counts.rounds(entry.roundsPlayed)}{' '}
                                            · {counts.wins(entry.wins)}
                                        </span>
                                        {(entry.streak ?? 0) >=
                                            StreakBadgeFrom && (
                                            <Badge
                                                variant="outline"
                                                icon={Flame}
                                                className="max-w-full"
                                            >
                                                <span className="truncate">
                                                    {t(':count-week streak', {
                                                        count:
                                                            entry.streak ?? 0,
                                                    })}
                                                </span>
                                            </Badge>
                                        )}
                                    </span>
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums">
                                    {formatNumber(entry.points)}{' '}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {t('pts')}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

export function Leaderboard({
    period,
    onPeriodChange,
    entries,
    loading = false,
    error = false,
    onRetry,
    currentUserId,
    className,
}: LeaderboardProps) {
    const { t } = useTrans();
    const isLoading = loading || (entries === undefined && !error);

    let body: ReactNode;

    if (error) {
        body = (
            <EmptyBlock
                icon={Trophy}
                title={t('Could not load the leaderboard.')}
                action={
                    onRetry && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onRetry}
                        >
                            <span className="truncate">{t('Try again')}</span>
                        </Button>
                    )
                }
            />
        );
    } else if (entries === undefined) {
        body = (
            <div
                data-slot="leaderboard-skeleton"
                className="flex flex-col gap-2"
            >
                {[0, 1, 2].map((index) => (
                    <Skeleton
                        key={index}
                        className="h-9 w-full animate-pulse motion-reduce:animate-none"
                    />
                ))}
            </div>
        );
    } else if (entries.length === 0) {
        body = (
            <EmptyBlock
                icon={Trophy}
                title={t('No games played yet.')}
                description={t(
                    'Scores show up here once the first game is finished.',
                )}
            />
        );
    } else {
        body = (
            <LeaderboardBody entries={entries} currentUserId={currentUserId} />
        );
    }

    return (
        <Tabs<GameLeaderboardPeriod>
            value={period}
            onValueChange={onPeriodChange}
            className="gap-0"
        >
            <Card data-slot="leaderboard" className={className}>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>
                            <h2>{t('Leaderboard')}</h2>
                        </CardTitle>
                        <TabsList aria-label={t('Period')}>
                            <TabsTrigger value="30d">
                                {t('Last 30 days')}
                            </TabsTrigger>
                            <TabsTrigger value="all">
                                {t('All time')}
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 @max-card-narrow/card:px-4 @max-card-narrow/card:pb-4">
                    {LeaderboardPeriods.map((value) => (
                        <TabsContent
                            key={value}
                            value={value}
                            aria-busy={isLoading}
                            className={cn(
                                'rounded-md transition-opacity duration-140 ease-standard focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                loading &&
                                    entries !== undefined &&
                                    'opacity-60',
                            )}
                        >
                            {value === period && body}
                        </TabsContent>
                    ))}
                </CardContent>
            </Card>
        </Tabs>
    );
}

export type GamesLeaderboardProps = {
    rooms: GamesRoom[];
    gameOptions: GameOption[];
    period: GameLeaderboardPeriod;
    onPeriodChange: (period: GameLeaderboardPeriod) => void;
    leaderboard?: GamesLeaderboardEntry[];
    leaderboardLoading?: boolean;
    leaderboardError?: boolean;
    onRetryLeaderboard?: () => void;
    currentUserId?: string;
    canCreateRoom: boolean;
    roomLimit?: number;
    onCreateRoom: NewGameRoomDialogProps['onCreate'];
    createErrors?: NewGameRoomErrors;
    creatingRoom?: boolean;
    roomAction?: (room: GamesRoom) => ReactNode;
    teamName?: string;
    backHref?: NonNullable<InertiaLinkProps['href']>;
    className?: string;
};

export function GamesLeaderboard({
    rooms,
    gameOptions,
    period,
    onPeriodChange,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    onRetryLeaderboard,
    currentUserId,
    canCreateRoom,
    roomLimit,
    onCreateRoom,
    createErrors,
    creatingRoom,
    roomAction,
    teamName,
    backHref,
    className,
}: GamesLeaderboardProps) {
    const { t } = useTrans();
    const liveCount = rooms.filter((room) => room.status === 'live').length;
    const isLimitReached =
        !canCreateRoom && roomLimit !== undefined && rooms.length >= roomLimit;

    return (
        <div
            data-slot="games-leaderboard"
            className={cn('@container flex min-w-0 flex-col gap-6', className)}
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="font-display text-xl font-bold">
                        {t('Games')}
                    </h1>
                    {teamName && (
                        <p className="text-sm text-muted-foreground">
                            {t('Short games to warm up :team.', {
                                team: teamName,
                            })}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {backHref && (
                        <Button variant="outline" asChild>
                            <Link href={backHref}>
                                <ArrowLeft aria-hidden />
                                <span className="truncate">
                                    {t('Back to the team')}
                                </span>
                            </Link>
                        </Button>
                    )}
                    {canCreateRoom && (
                        <NewGameRoomDialog
                            gameOptions={gameOptions}
                            onCreate={onCreateRoom}
                            errors={createErrors}
                            processing={creatingRoom}
                        />
                    )}
                </div>
            </div>

            {isLimitReached && (
                <p className="text-sm text-muted-foreground">
                    {t(
                        roomLimit === 1
                            ? 'This team already has :count game room.'
                            : 'This team already has :count game rooms.',
                        { count: roomLimit },
                    )}
                </p>
            )}

            <div className="grid min-w-0 gap-6 @3xl:grid-cols-2">
                <Card data-slot="game-rooms">
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle>
                                <h2>{t('Rooms')}</h2>
                            </CardTitle>
                            {liveCount > 0 && (
                                <Badge variant="muted">
                                    <span className="truncate">
                                        {t(':count live', { count: liveCount })}
                                    </span>
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    {rooms.length === 0 ? (
                        <EmptyBlock
                            icon={Gamepad2}
                            title={t('No game rooms yet.')}
                            description={t(
                                'Create a room and share the link: guests join without an account.',
                            )}
                            action={
                                canCreateRoom && (
                                    <NewGameRoomDialog
                                        variant="outline"
                                        gameOptions={gameOptions}
                                        onCreate={onCreateRoom}
                                        errors={createErrors}
                                        processing={creatingRoom}
                                    />
                                )
                            }
                        />
                    ) : (
                        <CardContent className="px-4 pb-4">
                            <GameRoomList
                                rooms={rooms}
                                roomAction={roomAction}
                            />
                        </CardContent>
                    )}
                </Card>

                <Leaderboard
                    period={period}
                    onPeriodChange={onPeriodChange}
                    entries={leaderboard}
                    loading={leaderboardLoading}
                    error={leaderboardError}
                    onRetry={onRetryLeaderboard}
                    currentUserId={currentUserId}
                />
            </div>
        </div>
    );
}
