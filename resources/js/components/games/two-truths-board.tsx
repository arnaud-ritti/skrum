import { Eye } from 'lucide-react';
import { useState } from 'react';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import type {
    GamePointsAward,
    GameRound,
    GameRoundEnded,
    GameStatementVotes,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';
import { useRoundChoice } from './use-round-choice';

function LieBadge({ isLie }: { isLie: boolean }) {
    const { t } = useTrans();

    return (
        <Badge variant={isLie ? 'destructive' : 'success'} shape="pill">
            {isLie ? t('Lie') : t('True')}
        </Badge>
    );
}

/** A round in play (spec §9.7): the teller's statements, the others vote the lie. */
export function TwoTruthsBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const statements = round.statements ?? [];
    const voters = round.voters ?? [];
    const teller =
        players.find((player) => player.id === round.leaderPlayerId) ?? null;
    const isTeller = round.leaderPlayerId === me.playerId;
    const canReveal = isTeller || room.isHost;
    const onlineIds = new Set(ctx.online.map((member) => member.id));
    const isTellerOnline = teller !== null && onlineIds.has(teller.presenceId);
    const total = Math.max(
        ctx.online.length - (isTellerOnline ? 1 : 0),
        voters.length,
    );
    const myChoice = typeof round.myChoice === 'number' ? round.myChoice : null;
    const target = { room: room.id, round: round.id };
    const choice = useRoundChoice<number>({
        round,
        current: myChoice,
        onSent: (sent) =>
            ctx.dispatch({
                type: 'vote.changed',
                roundId: round.id,
                playerId: me.playerId,
                voted: sent !== null,
            }),
    });

    const reveal = async () => {
        setBusy(true);

        let response: { ended?: GameRoundEnded | null } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended?: GameRoundEnded | null }>(
                    GameRevealsController.store(target),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response?.ended) {
            return;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();
    };

    return (
        <section
            data-slot="two-truths-board"
            aria-labelledby="two-truths-teller"
            className="flex w-full max-w-2xl flex-col gap-4"
        >
            <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar
                    name={teller?.name ?? t('Someone')}
                    src={teller?.avatarUrl}
                    kind={teller?.isGuest ? 'guest' : 'member'}
                    decorative
                />
                <h3
                    id="two-truths-teller"
                    className="min-w-0 truncate font-display text-xl font-title"
                >
                    {isTeller
                        ? t('Your statements')
                        : t(":name's statements", {
                              name: teller?.name ?? t('Someone'),
                          })}
                </h3>
            </div>
            {isTeller ? (
                <ul className="flex flex-col gap-3">
                    {statements.map((statement, index) => (
                        <li key={index}>
                            <Card
                                className={cn(
                                    'flex-row items-start gap-3 p-4',
                                    index === round.lieIndex &&
                                        'border-skrum-destructive-text',
                                )}
                            >
                                <p className="min-w-0 flex-1 text-lg break-words">
                                    {statement}
                                </p>
                                {index === round.lieIndex && <LieBadge isLie />}
                            </Card>
                        </li>
                    ))}
                </ul>
            ) : (
                <RadioGroup
                    aria-label={t('Which one is the lie?')}
                    value={myChoice === null ? '' : String(myChoice)}
                    className="w-full gap-3"
                    {...choice.groupProps}
                >
                    {statements.map((statement, index) => (
                        <RadioGroupCardItem
                            key={index}
                            value={String(index)}
                            aria-disabled={choice.busy || undefined}
                            onClick={() => choice.choose(index)}
                            className="p-4 aria-disabled:cursor-progress"
                        >
                            <span className="text-lg break-words">
                                {statement}
                            </span>
                            <span className="sr-only">
                                {t("It's the lie!")}
                            </span>
                        </RadioGroupCardItem>
                    ))}
                </RadioGroup>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm font-medium">
                    {t(':count of :total voted', {
                        count: voters.length,
                        total,
                    })}
                </p>
                {canReveal && (
                    <Button
                        disabled={busy || choice.busy}
                        onClick={() => void reveal()}
                    >
                        <Eye aria-hidden />
                        {t('Reveal the lie')}
                    </Button>
                )}
            </div>
        </section>
    );
}

type TwoTruthsResultProps = {
    statements: string[];
    lieIndex: number | null;
    votes: GameStatementVotes[];
    /** The points of the round, on the end card; none in the history. */
    points?: GamePointsAward[];
};

/** After the reveal: the lie, the truths, who picked each one. */
export function TwoTruthsResult({
    statements,
    lieIndex,
    votes,
    points = [],
}: TwoTruthsResultProps) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const byId = new Map(snapshot.players.map((player) => [player.id, player]));
    const finderPoints = points.find((award) => award.isWin)?.points ?? null;

    return (
        <ul
            data-slot="two-truths-result"
            className="flex w-full flex-col gap-3 text-left"
        >
            {statements.map((statement, index) => {
                const isLie = index === lieIndex;
                const pickers =
                    votes.find((vote) => vote.index === index)?.playerIds ?? [];
                const names = pickers.map(
                    (playerId) => byId.get(playerId)?.name ?? t('Someone'),
                );

                return (
                    <li key={index}>
                        <Card
                            className={cn(
                                'gap-3 p-4',
                                isLie &&
                                    'border-transparent bg-skrum-destructive-soft',
                            )}
                        >
                            <div className="flex min-w-0 items-start gap-3">
                                <p className="min-w-0 flex-1 text-lg break-words">
                                    {statement}
                                </p>
                                <LieBadge isLie={isLie} />
                            </div>
                            {pickers.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <ul
                                        aria-label={t('Picked by :names', {
                                            names: names.join(', '),
                                        })}
                                        className="flex flex-wrap -space-x-1.5"
                                    >
                                        {pickers.map((playerId) => {
                                            const player = byId.get(playerId);

                                            return (
                                                <li
                                                    key={playerId}
                                                    className="flex rounded-full ring-2 ring-card"
                                                >
                                                    <PersonAvatar
                                                        name={
                                                            player?.name ??
                                                            t('Someone')
                                                        }
                                                        src={player?.avatarUrl}
                                                        kind={
                                                            player?.isGuest
                                                                ? 'guest'
                                                                : 'member'
                                                        }
                                                        size="sm"
                                                        decorative
                                                    />
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {isLie && finderPoints !== null && (
                                        <Badge variant="success" shape="pill">
                                            {t('+:points', {
                                                points: finderPoints,
                                            })}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </Card>
                    </li>
                );
            })}
        </ul>
    );
}
