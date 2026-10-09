import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { nextLeaderId, rotationAfter } from '@/lib/games/rotation';
import {
    LeaderGames,
    MinimumPlayers,
    startPayload,
    tellerCandidates,
} from '@/lib/games/turns';
import type {
    GameKind,
    GamePlayer,
    GameStartResponse,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type LeaderPickerProps = {
    players: GamePlayer[];
    value: string | null;
    onChange: (playerId: string) => void;
    label: string;
};

function LeaderPicker({ players, value, onChange, label }: LeaderPickerProps) {
    return (
        <div className="flex max-w-full flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Select value={value ?? undefined} onValueChange={onChange}>
                <SelectTrigger className="w-48 max-w-full" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                            <PersonAvatar
                                decorative
                                size="xs"
                                name={player.name}
                                src={player.avatarUrl}
                                kind={player.isGuest ? 'guest' : 'member'}
                            />
                            <span className="truncate">{player.name}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function leaderLabel(
    game: GameKind,
    t: ReturnType<typeof useTrans>['t'],
): string {
    if (game === 'draw') {
        return t('Who draws?');
    }

    if (game === 'two_truths') {
        return t('Who tells?');
    }

    return t('Who gives the clues?');
}

export function StartRoundControls({ label }: { label: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [undercoverCount, setUndercoverCount] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [chosenLeaderId, setChosenLeaderId] = useState<string | null>(null);
    const { room, games, players, history, truthSets } = ctx.snapshot;
    const onlineIds = useMemo(
        () => new Set(ctx.online.map((member) => member.id)),
        [ctx.online],
    );
    const onlinePlayers = players.filter((player) =>
        onlineIds.has(player.presenceId),
    );
    const onlineOrder = onlinePlayers.map((player) => player.id);
    const defaultUndercoverCount =
        onlineOrder.length <= 6
            ? 1
            : onlineOrder.length <= 10
              ? 2
              : Math.floor(onlineOrder.length / 4);
    const selectedUndercoverCount = Math.min(
        undercoverCount ?? defaultUndercoverCount,
        Math.max(1, Math.floor((onlineOrder.length - 1) / 2)),
    );
    const isTwoTruths = room.game === 'two_truths';
    const needsLeader = LeaderGames.includes(room.game);
    const isAvailable = games.some(
        (option) => option.value === room.game && option.available,
    );
    const lastEnded = ctx.lastEnded ?? history[0] ?? null;
    const previousLeaderId = lastEnded?.leaderPlayerId ?? null;
    const tellerIds = isTwoTruths
        ? tellerCandidates(
              truthSets?.ready ?? [],
              rotationAfter(players, previousLeaderId)
                  .filter((player) => onlineIds.has(player.presenceId))
                  .map((player) => player.id),
          )
        : [];
    const leaderChoices = isTwoTruths
        ? tellerIds.flatMap(
              (id) => players.find((player) => player.id === id) ?? [],
          )
        : onlinePlayers;
    const proposedLeaderId = isTwoTruths
        ? (tellerIds[0] ?? null)
        : nextLeaderId(players, onlineIds, previousLeaderId);
    const leaderId =
        chosenLeaderId !== null &&
        leaderChoices.some((player) => player.id === chosenLeaderId)
            ? chosenLeaderId
            : proposedLeaderId;
    const minimumPlayers = MinimumPlayers[room.game];
    const isWaiting = onlinePlayers.length < minimumPlayers;
    const hasNoTeller = isTwoTruths && leaderChoices.length === 0;
    const closedGame =
        lastEnded !== null &&
        lastEnded.number != null &&
        lastEnded.number === lastEnded.roundsTotal;

    if (!room.isHost) {
        return (
            <p className="text-muted-foreground">
                {t('Waiting for the host to start.')}
            </p>
        );
    }

    if (!isAvailable) {
        return (
            <p className="text-muted-foreground">
                {t('This game is not available.')}
            </p>
        );
    }

    const start = async () => {
        setBusy(true);

        let response: GameStartResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameStartResponse>(
                    GameRoundsController.store(room.id),
                    {
                        ...startPayload(
                            room.game,
                            room.settings,
                            leaderId,
                            onlineOrder,
                        ),
                        ...(room.game === 'undercover'
                            ? { undercover_count: selectedUndercoverCount }
                            : {}),
                    },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        setChosenLeaderId(null);

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
        }

        ctx.dispatch({ type: 'round.started', round: response.round });
    };

    return (
        <div className="flex max-w-full flex-col items-center gap-3">
            {room.game === 'undercover' && !isWaiting && (
                <label className="flex items-center gap-2 text-sm">
                    {t('Number of Undercover players')}
                    <Select
                        value={String(selectedUndercoverCount)}
                        onValueChange={(value) =>
                            setUndercoverCount(Number(value))
                        }
                    >
                        <SelectTrigger
                            aria-label={t('Number of Undercover players')}
                            className="w-20"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from(
                                {
                                    length: Math.floor(
                                        (onlineOrder.length - 1) / 2,
                                    ),
                                },
                                (_, index) => index + 1,
                            ).map((count) => (
                                <SelectItem key={count} value={String(count)}>
                                    {count}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>
            )}
            {needsLeader && !isWaiting && !hasNoTeller && (
                <LeaderPicker
                    players={leaderChoices}
                    value={leaderId}
                    onChange={setChosenLeaderId}
                    label={leaderLabel(room.game, t)}
                />
            )}
            {isWaiting && (
                <p className="text-sm text-muted-foreground">
                    {minimumPlayers > 2
                        ? t('Waiting for players (:count needed)', {
                              count: minimumPlayers,
                          })
                        : t('Waiting for another player')}
                </p>
            )}
            {!isWaiting && hasNoTeller && (
                <p className="text-sm text-muted-foreground">
                    {t('No one has statements ready.')}
                </p>
            )}
            <Button
                disabled={
                    busy || isWaiting || (needsLeader && leaderId === null)
                }
                onClick={() => void start()}
                className="max-w-full"
            >
                <Play aria-hidden />
                <span className="truncate">
                    {closedGame ? t('New game') : label}
                </span>
            </Button>
        </div>
    );
}
