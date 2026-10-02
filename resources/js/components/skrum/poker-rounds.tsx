import { Check, ChevronDown, CircleAlert, History, Split } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard } from '@/lib/poker/types';
import type { PokerResult, PokerRound } from '@/lib/poker/types';
import { cn } from '@/lib/utils';

export type PokerRoundsProps = {
    /** Rounds of a task as the server lists them, shown in the given order. */
    rounds: PokerRound[];
    /** Resolves a vote's player; a player who left is "Former member". */
    players?: { id: string; name: string }[];
    /** Count in the trigger; the task's `roundsCount` while the list loads. */
    count?: number;
    status?: 'ready' | 'loading' | 'failed';
    isNumeric?: boolean;
    locale?: string;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
};

function formatAverage(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        value,
    );
}

/** Lowest and highest estimate that got a vote, in deck order. */
function spreadOf(result: PokerResult): [string, string] | null {
    const played = result.distribution
        .filter((entry) => entry.count > 0 && !isSpecialCard(entry.value))
        .map((entry) => entry.value);

    return played.length > 1 ? [played[0], played[played.length - 1]] : null;
}

function MiniCard({
    value,
    highlighted,
}: {
    value: string;
    highlighted: boolean;
}) {
    return (
        <span
            data-slot="poker-round-card"
            data-highlighted={highlighted || undefined}
            className={cn(
                'grid h-9 max-w-full min-w-7 shrink-0 place-items-center rounded-sm border px-1 font-display text-sm font-bold whitespace-nowrap',
                highlighted
                    ? 'border-primary bg-skrum-primary-soft text-skrum-primary-text'
                    : 'border-border bg-card text-foreground',
            )}
        >
            <span className="max-w-full truncate">{value}</span>
        </span>
    );
}

function RoundResult({
    result,
    isNumeric,
    locale,
}: {
    result: PokerResult;
    isNumeric?: boolean;
    locale?: string;
}) {
    const { t } = useTrans();
    const countable = result.average !== null || result.mode.length > 0;

    if (!countable) {
        return (
            <Badge variant="muted" className="max-w-full">
                <span className="truncate">{t('No countable votes')}</span>
            </Badge>
        );
    }

    const spread = spreadOf(result);
    const consensusValue = result.mode[0] ?? result.nearestCard;
    const showsAverage = isNumeric !== false && result.average !== null;
    const mostPlayed =
        result.mode.length > 0
            ? t('Most played: :cards', { cards: result.mode.join(', ') })
            : null;
    const summary =
        showsAverage && result.average !== null
            ? `${t('Average')}: ${formatAverage(result.average, locale)}`
            : mostPlayed;

    return (
        <>
            {result.consensus ? (
                <Badge variant="success" icon={Check} className="max-w-full">
                    <span className="truncate">
                        {consensusValue
                            ? `${t('Consensus')} · ${consensusValue}`
                            : t('Consensus')}
                    </span>
                </Badge>
            ) : (
                <Badge variant="warning" icon={Split} className="max-w-full">
                    <span className="truncate">
                        {spread
                            ? t('Spread :min → :max', {
                                  min: spread[0],
                                  max: spread[1],
                              })
                            : t('Needs discussion')}
                    </span>
                </Badge>
            )}
            {summary !== null && (
                <span
                    data-slot="poker-round-summary"
                    className="min-w-0 truncate text-xs text-muted-foreground"
                >
                    {summary}
                </span>
            )}
        </>
    );
}

function RoundVotes({
    round,
    nameOf,
}: {
    round: PokerRound;
    nameOf: (playerId: string) => string;
}) {
    const { t } = useTrans();
    const mode = round.result?.mode ?? [];

    // An anonymous round lists the values in deck order, never next to a name
    // and never in the order the votes came in.
    if (round.anonymous) {
        const values = (round.result?.distribution ?? []).flatMap(
            ({ value, count }) => Array.from({ length: count }, () => value),
        );

        return (
            <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">
                    {t('Anonymous votes')}
                </p>
                <ul
                    aria-label={t('Anonymous votes')}
                    className="flex min-w-0 flex-wrap gap-1.5"
                >
                    {values.map((value, index) => (
                        <li key={`${value}-${index}`} className="flex min-w-0">
                            <MiniCard
                                value={value}
                                highlighted={mode.includes(value)}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <ul
            aria-label={t('Votes')}
            className="flex min-w-0 flex-wrap gap-x-3 gap-y-1.5"
        >
            {round.votes.map((vote) => (
                <li
                    key={vote.playerId}
                    data-slot="poker-round-vote"
                    className="flex max-w-full min-w-0 items-center gap-1.5 text-xs"
                >
                    <MiniCard
                        value={vote.value ?? '—'}
                        highlighted={
                            vote.value !== null && mode.includes(vote.value)
                        }
                    />
                    <span className="min-w-0 truncate text-muted-foreground">
                        {nameOf(vote.playerId)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export function PokerRounds({
    rounds,
    players = [],
    count,
    status = 'ready',
    isNumeric,
    locale,
    open,
    defaultOpen,
    onOpenChange,
    className,
}: PokerRoundsProps) {
    const { t } = useTrans();
    const names = new Map(players.map((player) => [player.id, player.name]));
    const nameOf = (playerId: string): string =>
        names.get(playerId) ?? t('Former member');

    return (
        <Collapsible
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            data-slot="poker-rounds"
            className={cn('flex min-w-0 flex-col', className)}
        >
            <CollapsibleTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group -ml-2 h-8 max-w-full min-w-0 gap-1.5 self-start text-sm text-muted-foreground"
                >
                    <History aria-hidden />
                    <span className="truncate">
                        {`${t('Rounds')} (${count ?? rounds.length})`}
                    </span>
                    <ChevronDown
                        aria-hidden
                        className="transition-transform duration-220 ease-standard group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
                {status === 'loading' && (
                    <Skeleton
                        data-slot="poker-rounds-loading"
                        className="mt-2 h-16 w-full rounded-lg"
                    />
                )}
                {status === 'failed' && (
                    <p
                        role="alert"
                        className="mt-2 flex items-center gap-1.5 text-sm text-skrum-destructive-text"
                    >
                        <CircleAlert className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0">
                            {t('Could not load the rounds.')}
                        </span>
                    </p>
                )}
                {status === 'ready' && rounds.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t('No rounds yet.')}
                    </p>
                )}
                {status === 'ready' && rounds.length > 0 && (
                    <ol className="mt-2 flex min-w-0 flex-col gap-2">
                        {rounds.map((round) => (
                            <li
                                key={round.id}
                                data-slot="poker-round"
                                data-revealed={round.revealedAt !== null}
                                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-background p-3"
                            >
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">
                                        {t('Round :number', {
                                            number: round.number,
                                        })}
                                    </span>
                                    {round.revealedAt !== null &&
                                        round.result && (
                                            <RoundResult
                                                result={round.result}
                                                isNumeric={isNumeric}
                                                locale={locale}
                                            />
                                        )}
                                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                        {round.revealedAt === null
                                            ? t('Not revealed · :count votes', {
                                                  count: round.votesCount,
                                              })
                                            : t(':count votes', {
                                                  count: round.votesCount,
                                              })}
                                    </span>
                                </div>
                                {round.revealedAt !== null && (
                                    <RoundVotes round={round} nameOf={nameOf} />
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
