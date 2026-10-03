import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { nextLeaderId } from '@/lib/games/rotation';
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
import { LeaderPicker } from './leader-picker';
import { useRoom } from './room-context';

/** The players in join order, starting after the previous leader. */
function rotationAfter(
    players: GamePlayer[],
    previousLeaderId: string | null,
): GamePlayer[] {
    const start = players.findIndex((player) => player.id === previousLeaderId);

    return [...players.slice(start + 1), ...players.slice(0, start + 1)];
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
    const isWaiting = onlinePlayers.length < MinimumPlayers[room.game];
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
                    startPayload(
                        room.game,
                        room.settings,
                        leaderId,
                        onlineOrder,
                    ),
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
                    {t('Waiting for another player')}
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
