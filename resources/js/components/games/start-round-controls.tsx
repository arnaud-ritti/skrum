import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { nextLeaderId } from '@/lib/games/rotation';
import type { GameKind, GameStartResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { LeaderPicker } from './leader-picker';
import { useRoom } from './room-context';

const LeaderGames: GameKind[] = ['draw', 'decoded'];

export function StartRoundControls({ label }: { label: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [chosenLeaderId, setChosenLeaderId] = useState<string | null>(null);
    const { room, games, players, history } = ctx.snapshot;
    const onlineIds = useMemo(
        () => new Set(ctx.online.map((member) => member.id)),
        [ctx.online],
    );
    const onlinePlayers = players.filter((player) =>
        onlineIds.has(player.presenceId),
    );
    const needsLeader = LeaderGames.includes(room.game);
    const isAvailable = games.some(
        (option) => option.value === room.game && option.available,
    );
    const previousLeaderId =
        ctx.lastEnded?.leaderPlayerId ?? history[0]?.leaderPlayerId ?? null;
    const leaderId =
        chosenLeaderId !== null &&
        onlinePlayers.some((player) => player.id === chosenLeaderId)
            ? chosenLeaderId
            : nextLeaderId(players, onlineIds, previousLeaderId);
    const isWaiting = needsLeader && onlinePlayers.length < 2;

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
                    needsLeader ? { leader_player_id: leaderId } : {},
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
        <div className="flex flex-col items-center gap-3">
            {needsLeader && !isWaiting && (
                <LeaderPicker
                    players={onlinePlayers}
                    value={leaderId}
                    onChange={setChosenLeaderId}
                    label={
                        room.game === 'draw'
                            ? t('Who draws?')
                            : t('Who gives the clues?')
                    }
                />
            )}
            {isWaiting && (
                <p className="text-sm text-muted-foreground">
                    {t('Waiting for another player')}
                </p>
            )}
            <Button
                disabled={
                    busy || isWaiting || (needsLeader && leaderId === null)
                }
                onClick={() => void start()}
            >
                <Play className="size-4" />
                {label}
            </Button>
        </div>
    );
}
