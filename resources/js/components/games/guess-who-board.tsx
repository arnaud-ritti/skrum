import { Check, MessageCircleQuestion, Shuffle } from 'lucide-react';
import { useId, useState } from 'react';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import GameTextAnswersController from '@/actions/App/Http/Controllers/Games/GameTextAnswersController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import type {
    GameDrawnAnswer,
    GameNomination,
    GamePlayer,
    GameRound,
    GameRoundEnded,
    GameTextRevealed,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { GuessWhoVote } from './guess-who-vote';
import { QuestionBanner } from './question-banner';
import { useRoom } from './room-context';

const AnswerMaxLength = 120;

/** The server's `MinimumAnswers`: a draw among fewer would name the author. */
const MinimumAnswers = 2;

function myTextAnswer(round: GameRound): GameTextRevealed | null {
    const answer = round.myAnswer ?? null;

    if (answer === null || !('text' in answer)) {
        return null;
    }

    return answer;
}

function PlayerAvatars({
    playerIds,
    label,
}: {
    playerIds: string[];
    label: string;
}) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const byId = new Map(snapshot.players.map((player) => [player.id, player]));

    if (playerIds.length === 0) {
        return null;
    }

    return (
        <ul aria-label={label} className="flex flex-wrap -space-x-1.5">
            {playerIds.map((playerId) => {
                const player = byId.get(playerId);

                return (
                    <li
                        key={playerId}
                        className="flex rounded-full ring-2 ring-card"
                    >
                        <PersonAvatar
                            name={player?.name ?? t('Someone')}
                            src={player?.avatarUrl}
                            kind={player?.isGuest ? 'guest' : 'member'}
                            size="sm"
                            decorative
                        />
                    </li>
                );
            })}
        </ul>
    );
}

function namesOf(playerIds: string[], players: GamePlayer[], someone: string) {
    const byId = new Map(players.map((player) => [player.id, player.name]));

    return playerIds
        .map((playerId) => byId.get(playerId) ?? someone)
        .join(', ');
}

/** Before the draw: everyone writes one answer to the question. */
function GuessWhoAnswers({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const fieldId = useId();
    const { room, me, players } = ctx.snapshot;
    const mine = myTextAnswer(round);
    const [text, setText] = useState(mine?.text ?? '');
    const [busy, setBusy] = useState(false);
    const answeredIds = pendingAnswers(round).map((answer) => answer.playerId);
    const hasEnoughAnswers = answeredIds.length >= MinimumAnswers;
    const draft = text.trim();
    const target = { room: room.id, round: round.id };

    const answered = (myAnswer: GameTextRevealed | null) => {
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { myAnswer },
        });
        ctx.dispatch({
            type: 'answer.changed',
            roundId: round.id,
            playerId: me.playerId,
            answered: myAnswer !== null,
        });
    };

    const send = async () => {
        if (draft === '' || draft === mine?.text) {
            return;
        }

        setBusy(true);

        let response: { myAnswer: GameTextRevealed } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ myAnswer: GameTextRevealed }>(
                    GameTextAnswersController.update(target),
                    { text: draft },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        setText(response.myAnswer.text);
        answered(response.myAnswer);
    };

    const remove = async () => {
        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest<null>(GameTextAnswersController.destroy(target)),
            );
        } finally {
            setBusy(false);
        }

        if (result === undefined) {
            return;
        }

        setText('');
        answered(null);
    };

    const draw = async () => {
        setBusy(true);

        /** A round the timer already closed answers with its end. */
        let response: GameRound | { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameRound | { ended: GameRoundEnded }>(
                    GameRevealsController.store(target),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        if ('ended' in response) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();

            return;
        }

        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: response,
        });
    };

    return (
        <div className="flex w-full max-w-2xl flex-col gap-4">
            <form
                className="flex flex-col gap-1.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                }}
            >
                <Label htmlFor={fieldId}>{t('Your answer')}</Label>
                <Textarea
                    id={fieldId}
                    value={text}
                    maxLength={AnswerMaxLength}
                    rows={2}
                    onChange={(event) => setText(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                        aria-hidden
                        className="text-xs text-muted-foreground tabular-nums"
                    >
                        {t(':count / :max', {
                            count: text.length,
                            max: AnswerMaxLength,
                        })}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {mine && (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void remove()}
                            >
                                {t('Remove')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={
                                busy || draft === '' || draft === mine?.text
                            }
                        >
                            {t('Send')}
                        </Button>
                    </div>
                </div>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <PlayerAvatars
                        playerIds={answeredIds}
                        label={t('Answered: :names', {
                            names: namesOf(answeredIds, players, t('Someone')),
                        })}
                    />
                    <p aria-live="polite" className="text-sm font-medium">
                        {t(':count answered', { count: answeredIds.length })}
                    </p>
                </div>
                {room.isHost && (
                    <div className="flex flex-col items-end gap-1">
                        <Button
                            disabled={busy || !hasEnoughAnswers}
                            onClick={() => void draw()}
                        >
                            <Shuffle aria-hidden />
                            {t('Draw an answer')}
                        </Button>
                        {!hasEnoughAnswers && (
                            <p className="text-xs text-muted-foreground">
                                {t('At least 2 answers are needed.')}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/** A round in play (spec §9.9): the answers, then the vote on the drawn one. */
export function GuessWhoBoard({ round }: { round: GameRound }) {
    const { t } = useTrans();
    const isDrawn = round.drawn !== null && round.drawn !== undefined;

    return (
        <div
            data-slot="guess-who-board"
            className="flex w-full flex-col items-center gap-4"
        >
            <QuestionBanner
                round={round}
                icon={MessageCircleQuestion}
                hint={
                    isDrawn
                        ? t('Guess who wrote the drawn answer.')
                        : t('Answer the question: one answer will be drawn.')
                }
            />
            {isDrawn ? (
                <GuessWhoVote round={round} />
            ) : (
                <GuessWhoAnswers round={round} />
            )}
        </div>
    );
}

type GuessWhoResultProps = {
    drawn: GameDrawnAnswer;
    nominations: GameNomination[];
};

/** Once closed: the drawn answer, its author, and who named each candidate. */
export function GuessWhoResult({ drawn, nominations }: GuessWhoResultProps) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const { players, me } = snapshot;
    const byId = new Map(players.map((player) => [player.id, player]));
    const author = byId.get(drawn.playerId) ?? null;
    const authorName = author?.name ?? t('Someone');

    return (
        <div
            data-slot="guess-who-result"
            className="flex w-full flex-col gap-3 text-left"
        >
            <Card className="gap-3 p-4">
                <p className="text-lg break-words">{drawn.text}</p>
                <div className="flex min-w-0 items-center gap-2">
                    <PersonAvatar
                        name={authorName}
                        src={author?.avatarUrl}
                        kind={author?.isGuest ? 'guest' : 'member'}
                        size="sm"
                        decorative
                    />
                    <span className="min-w-0 truncate text-sm font-medium">
                        {t('Written by :name', { name: authorName })}
                    </span>
                </div>
            </Card>
            <ul className="flex flex-col gap-2">
                {nominations.map(({ playerId, voterIds }) => {
                    const candidate = byId.get(playerId);
                    const name = candidate?.name ?? t('Someone');
                    const isAuthor = playerId === drawn.playerId;
                    const isMyVote = voterIds.includes(me.playerId);
                    const nameId = `guess-who-candidate-${playerId}`;

                    return (
                        <li
                            key={playerId}
                            aria-labelledby={nameId}
                            className={cn(
                                'flex min-w-0 flex-wrap items-center gap-3 rounded-lg border p-3',
                                isAuthor &&
                                    'border-primary bg-skrum-primary-soft',
                            )}
                        >
                            <PersonAvatar
                                name={name}
                                src={candidate?.avatarUrl}
                                kind={candidate?.isGuest ? 'guest' : 'member'}
                                size="sm"
                                decorative
                            />
                            <span
                                id={nameId}
                                className="min-w-0 truncate font-medium"
                            >
                                {name}
                            </span>
                            {isAuthor && (
                                <Badge variant="default" shape="pill">
                                    {t('Author')}
                                </Badge>
                            )}
                            <span className="flex-1" />
                            <PlayerAvatars
                                playerIds={voterIds}
                                label={t('Named by :names', {
                                    names: namesOf(
                                        voterIds,
                                        players,
                                        t('Someone'),
                                    ),
                                })}
                            />
                            {isMyVote && (
                                <Badge
                                    data-slot="my-vote"
                                    data-correct={isAuthor}
                                    variant={isAuthor ? 'success' : 'secondary'}
                                    shape="pill"
                                >
                                    {isAuthor && <Check aria-hidden />}
                                    {t('Your vote')}
                                </Badge>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
