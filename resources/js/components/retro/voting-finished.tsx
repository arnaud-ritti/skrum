import { CircleCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import VotingCompletionsController from '@/actions/App/Http/Controllers/Retros/VotingCompletionsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { finishedCount, isObserving } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';
import { PhaseVotingBar } from './phase-voting-bar';

const TakenBackNoticeMs = 5000;

/** "5/8 have finished": the people online who said they have finished voting. */
export function FinishedCount() {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const { finished, total } = finishedCount(board, online);

    return (
        <Badge
            variant="muted"
            shape="pill"
            data-slot="retro-finished-count"
            className="max-w-full"
        >
            <Users aria-hidden />
            <span aria-hidden className="truncate">
                {t(':finished/:total have finished', { finished, total })}
            </span>
            <span className="sr-only">
                {t(':finished of :total have finished', { finished, total })}
            </span>
        </Badge>
    );
}

/**
 * "I have finished voting", then "Change my votes". A vote cast or taken back
 * after finishing takes "finished" back on the server (decision 10, B): the
 * button returns and a polite line says why.
 */
export function FinishButton() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { board } = ctx;
    const isFinished = board.voting.finishedIds.includes(
        board.viewer.participantId,
    );
    const [pending, setPending] = useState(false);
    const [ownTarget, setOwnTarget] = useState<boolean | null>(null);
    const [previous, setPrevious] = useState(isFinished);
    const [takenBack, setTakenBack] = useState(false);

    if (isFinished !== previous) {
        setPrevious(isFinished);
        setTakenBack(previous && ownTarget !== false);
    }

    useEffect(() => {
        if (!takenBack) {
            return;
        }

        const timeout = window.setTimeout(
            () => setTakenBack(false),
            TakenBackNoticeMs,
        );

        return () => window.clearTimeout(timeout);
    }, [takenBack]);

    const send = async (finish: boolean) => {
        setPending(true);
        setOwnTarget(finish);

        const route = finish
            ? VotingCompletionsController.update(board.retro.id)
            : VotingCompletionsController.destroy(board.retro.id);
        const response = await ctx.run(
            retroRequest<{ finishedIds: string[] }>(route),
        );

        if (response) {
            ctx.apply({
                type: 'voting.finished',
                finishedIds: response.finishedIds,
            });
        }

        setPending(false);
    };

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {isFinished ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => void send(false)}
                    className="max-w-full"
                >
                    <span className="truncate">{t('Change my votes')}</span>
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void send(true)}
                    className="max-w-full"
                >
                    <CircleCheck aria-hidden />
                    <span className="truncate">
                        {t('I have finished voting')}
                    </span>
                </Button>
            )}
            <p
                aria-live="polite"
                data-slot="retro-finished-taken-back"
                className="min-w-0 text-body-sm text-muted-foreground empty:sr-only"
            >
                {takenBack
                    ? t(
                          "You changed your votes: you're no longer marked as finished.",
                      )
                    : ''}
            </p>
        </div>
    );
}

/**
 * The vote bar of the board: the cap per card after the budget, then how
 * many have finished and the viewer's "I have finished voting".
 */
export function BoardVotingBar({
    part = 'all',
}: {
    part?: 'all' | 'budget' | 'progress';
}) {
    const { board } = useBoard();
    const { t } = useTrans();
    const cap = board.retro.maxVotesPerCard;

    return (
        <PhaseVotingBar
            part={part}
            cap={
                cap === null
                    ? undefined
                    : t(' · max :count per card', { count: cap })
            }
            finished={<FinishedCount />}
            done={isObserving(board) ? undefined : <FinishButton />}
        />
    );
}
