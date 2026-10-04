import { CircleCheck } from 'lucide-react';
import { useId, useState } from 'react';
import RetroRotiController from '@/actions/App/Http/Controllers/Retros/RetroRotiController';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import {
    ROTIHiddenDistribution,
    ROTIWidget,
} from '@/components/skrum/roti-widget';
import type { Roti } from '@/components/skrum/roti-widget';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { isObserving } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { toRotiResult } from '@/lib/retro/session-end';
import type {
    PresenceMember,
    RotiVoteResponse,
    Snapshot,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { useRotiNudgeToast } from './roti-facilitation';

/**
 * The viewer's rating: a press on a score gives it, a press on the score
 * already given takes it back.
 */
function useRotiVote(): {
    value: Roti | null;
    busy: boolean;
    vote: (score: Roti) => void;
} {
    const ctx = useBoard();
    const [busy, setBusy] = useState(false);
    const { myScore } = ctx.board.roti;
    const retroId = ctx.board.retro.id;

    const rate = async (score: Roti) => {
        if (busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(
            score === myScore
                ? retroRequest<RotiVoteResponse>(
                      RetroRotiController.destroy(retroId),
                  )
                : retroRequest<RotiVoteResponse>(
                      RetroRotiController.update(retroId),
                      { score },
                  ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'roti.set',
            myScore: response.myScore,
            respondents: response.respondents,
            voterIds: response.voterIds,
        });

        // Once completed the results are on screen: they follow the rating.
        if (ctx.board.retro.phase === 'completed') {
            await ctx.refetch();
        }
    };

    return {
        value: (myScore as Roti | null) ?? null,
        busy,
        vote: (score) => void rate(score),
    };
}

type RotiVoter = PresenceMember & { hasVoted: boolean; isMe: boolean };

/**
 * Who is in the room, the viewer first, each with whether they have voted.
 * Never a score: the server sends none. Before the presence channel has
 * answered, the viewer alone.
 */
export function rotiVoters(
    board: Pick<Snapshot, 'roti' | 'viewer' | 'participants'>,
    online: PresenceMember[],
): RotiVoter[] {
    const selfId = board.viewer.participantId;
    const present =
        online.length > 0
            ? online
            : board.participants.filter(
                  (participant) => participant.id === selfId,
              );
    const voted = new Set(board.roti.voterIds);

    return present
        .map((member) => ({
            ...member,
            hasVoted: voted.has(member.id),
            isMe: member.id === selfId,
        }))
        .sort((a, b) => Number(b.isMe) - Number(a.isMe));
}

function Trema() {
    return (
        <span aria-hidden className="inline-flex shrink-0 gap-0.5">
            <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
            <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
        </span>
    );
}

function VoterRow({ voter }: { voter: RotiVoter }) {
    const { t } = useTrans();

    return (
        <li
            data-participant-id={voter.id}
            data-voted={voter.hasVoted}
            className={cn(
                'flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-sm',
                !voter.hasVoted && 'bg-muted',
            )}
        >
            <PersonAvatar
                name={voter.name}
                src={voter.avatarUrl}
                kind={voter.isGuest ? 'guest' : 'member'}
                size="sm"
                decorative
            />
            <span className="min-w-0 flex-1 truncate">
                {voter.isMe
                    ? t(':name (you)', { name: voter.name })
                    : voter.name}
            </span>
            <span
                data-slot="roti-voter-state"
                className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold',
                    voter.hasVoted
                        ? 'text-skrum-success-text'
                        : 'text-muted-foreground',
                )}
            >
                {voter.hasVoted ? (
                    <>
                        <CircleCheck className="size-3.5" aria-hidden />
                        {t('Voted')}
                    </>
                ) : (
                    <>
                        <Trema />
                        {t('ROTI voter thinking')}
                    </>
                )}
            </span>
        </li>
    );
}

/**
 * "Who has voted": everyone in the room with "Voted" or "Thinking". On a
 * phone the list is the stack of those who have voted.
 */
function WhoHasVoted({ closed }: { closed: boolean }) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const titleId = useId();
    const voters = rotiVoters(board, online);
    const voted = voters.filter((voter) => voter.hasVoted);
    const count = t(':voted of :total have voted', {
        voted: voted.length,
        total: voters.length,
    });

    return (
        <Card
            asChild
            data-slot="retro-roti-voters"
            className="min-w-0 gap-4 p-5"
        >
            <section aria-labelledby={titleId}>
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <h2
                        id={titleId}
                        className="min-w-0 truncate text-base font-title"
                    >
                        {t('Who has voted')}
                    </h2>
                    <Badge
                        variant="success"
                        shape="pill"
                        data-slot="retro-roti-count"
                        className="shrink-0 tabular-nums"
                    >
                        <span aria-hidden>
                            {voted.length}/{voters.length}
                        </span>
                        <span className="sr-only">{count}</span>
                    </Badge>
                </div>
                <Progress
                    value={voted.length}
                    max={Math.max(1, voters.length)}
                    tone="success"
                    valueLabel=""
                    aria-label={count}
                    aria-valuetext={count}
                />
                {isMobile ? (
                    voted.length > 0 && (
                        <AvatarStack
                            size="sm"
                            people={voted.map((voter) => ({
                                name: voter.name,
                                src: voter.avatarUrl,
                                kind: voter.isGuest ? 'guest' : 'member',
                            }))}
                        />
                    )
                ) : (
                    <ul
                        data-test="retro-roti-voters"
                        className="flex min-w-0 flex-col gap-0.5"
                    >
                        {voters.map((voter) => (
                            <VoterRow key={voter.id} voter={voter} />
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">
                    {closed
                        ? t('Votes are closed.')
                        : t(
                              'Results appear for everyone when the facilitator reveals them or ends the session.',
                          )}
                </p>
            </section>
        </Card>
    );
}

/**
 * The vote alone, in the narrow layout: what a retro completed before the
 * ROTI phase existed still shows beside its results.
 */
export function RotiVote({ className }: { className?: string }) {
    const { board } = useBoard();
    const { value, vote } = useRotiVote();

    if (isObserving(board)) {
        return null;
    }

    return (
        <ROTIWidget
            mode="vote"
            value={value}
            onVote={vote}
            className={className}
        />
    );
}

/**
 * ROTI: the last step. Everyone gives a score; the room sees who has voted,
 * never what. The distribution shows once the facilitator reveals it, which
 * closes the vote, or ends the session (RT-9).
 */
export function PhaseRoti() {
    const { t } = useTrans();
    const { board } = useBoard();
    const { value, vote } = useRotiVote();
    const nudged = useRotiNudgeToast();
    const results = board.roti.revealed ? board.roti.results : null;
    const votes = results === null && !isObserving(board);

    return (
        <div
            data-slot="retro-roti"
            className="mx-auto grid w-full max-w-5xl min-w-0 grid-cols-1 content-start items-start gap-6 px-4 pt-5 md:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:pt-16"
        >
            <div
                data-slot="retro-roti-widget"
                data-nudged={nudged}
                className={cn(
                    'min-w-0',
                    nudged && 'animate-nudge motion-reduce:animate-none',
                )}
            >
                {results && (
                    <ROTIWidget mode="result" result={toRotiResult(results)} />
                )}
                {votes && (
                    <ROTIWidget
                        mode="vote"
                        layout="row"
                        value={value}
                        onVote={vote}
                        eyebrow={t(
                            'Last step · ROTI (return on time invested)',
                        )}
                        labels={{
                            saved: t(
                                'Vote saved · you can change it until the session ends',
                            ),
                        }}
                        footer={
                            <ROTIHiddenDistribution
                                title={t('Votes hidden until the end')}
                                note={t(
                                    'Anonymous · nobody sees who voted what',
                                )}
                            />
                        }
                        className="min-w-0"
                    />
                )}
            </div>
            <WhoHasVoted closed={results !== null} />
        </div>
    );
}
