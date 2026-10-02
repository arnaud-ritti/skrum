import { EyeOff, Minus, ThumbsUp, Vote, CircleSlash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type VoteBudgetProps = {
    total: number;
    remaining: number;
    /** Said after the dots, in a quieter voice: "of 5", a rule of the vote. */
    detail?: ReactNode;
    className?: string;
};

export type CardVotesProps = {
    mine: number;
    total: number | null;
    maxPerCard?: number;
    budgetLeft: number;
    /**
     * Why nobody may vote here now (a closed board). The vote button is
     * disabled with this reason and no vote can be taken back.
     */
    disabledReason?: string;
    onVote: () => void;
    onUnvote: () => void;
    className?: string;
};

function VoteDot({ filled, pop }: { filled: boolean; pop?: boolean }) {
    return (
        <span
            data-slot="vote-dot"
            data-filled={filled}
            className={cn(
                'size-2.5 shrink-0 rounded-full border border-primary',
                filled ? 'bg-primary' : 'bg-transparent opacity-60',
                pop && 'animate-vote-pop motion-reduce:animate-none',
            )}
        />
    );
}

export function VoteBudget({
    total,
    remaining,
    detail,
    className,
}: VoteBudgetProps) {
    const { t } = useTrans();
    const safeRemaining = Math.min(Math.max(remaining, 0), total);
    const isEmpty = safeRemaining === 0;
    const Icon = isEmpty ? CircleSlash : Vote;
    const isSingle = safeRemaining === 1;
    const leftLabel = isSingle
        ? t(':count vote left', { count: safeRemaining })
        : t(':count votes left', { count: safeRemaining });
    const label = isEmpty ? t('No votes left') : leftLabel;
    const leftOfTotalLabel = isSingle
        ? t(':count vote left of :total', { count: safeRemaining, total })
        : t(':count votes left of :total', { count: safeRemaining, total });

    return (
        <div
            data-slot="vote-budget"
            role="status"
            aria-live="polite"
            aria-label={isEmpty ? label : leftOfTotalLabel}
            className={cn(
                'inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-card',
                isEmpty ? 'text-muted-foreground' : 'text-foreground',
                className,
            )}
        >
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{label}</span>
            <span aria-hidden className="flex shrink-0 items-center gap-1">
                {Array.from({ length: total }, (_, index) => (
                    <VoteDot key={index} filled={index < safeRemaining} />
                ))}
            </span>
            {detail !== undefined && detail !== null && (
                <span
                    data-slot="vote-budget-detail"
                    className="min-w-0 truncate text-xs font-normal text-muted-foreground"
                >
                    {detail}
                </span>
            )}
        </div>
    );
}

export function CardVotes({
    mine,
    total,
    maxPerCard,
    budgetLeft,
    disabledReason,
    onVote,
    onUnvote,
    className,
}: CardVotesProps) {
    const { t } = useTrans();
    const [previousMine, setPreviousMine] = useState(mine);
    const [poppedIndex, setPoppedIndex] = useState<number | null>(null);

    if (mine !== previousMine) {
        setPreviousMine(mine);
        setPoppedIndex(mine > previousMine ? mine - 1 : null);
    }

    const isOutOfBudget = budgetLeft <= 0;
    const isAtCardLimit = maxPerCard !== undefined && mine >= maxPerCard;
    const isClosed = disabledReason !== undefined;
    const isVoteBlocked = isClosed || isOutOfBudget || isAtCardLimit;
    const budgetReason = isOutOfBudget
        ? t('You have used all your votes')
        : t('You reached the limit of :max votes on this card', {
              max: maxPerCard ?? 0,
          });
    const blockedReason = disabledReason ?? budgetReason;

    const voteButtonRef = useRef<HTMLButtonElement>(null);
    const wrapperRef = useRef<HTMLSpanElement>(null);

    /**
     * The press that spends the last vote disables the button it was made on.
     * Focus moves to the wrapper, so V and Shift+V keep reaching this control.
     */
    useEffect(() => {
        if (isVoteBlocked && document.activeElement === voteButtonRef.current) {
            wrapperRef.current?.focus();
        }
    }, [isVoteBlocked]);

    function vote(): void {
        if (isVoteBlocked) {
            return;
        }

        onVote();
    }

    function unvote(): void {
        if (isClosed || mine <= 0) {
            return;
        }

        onUnvote();
    }

    /**
     * Taking the last vote back removes the button that was pressed. Focus
     * goes to the vote button, or to its wrapper while it is disabled.
     */
    function unvoteFromButton(): void {
        unvote();

        if (mine > 1) {
            return;
        }

        const target = voteButtonRef.current?.disabled
            ? wrapperRef.current
            : voteButtonRef.current;

        target?.focus();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key !== 'v' && event.key !== 'V') {
            return;
        }

        event.preventDefault();
        if (event.shiftKey) {
            unvote();

            return;
        }

        vote();
    }

    const voteButton = (
        <button
            ref={voteButtonRef}
            type="button"
            data-slot="vote-button"
            aria-label={t('Add a vote')}
            aria-pressed={mine > 0}
            disabled={isVoteBlocked}
            onClick={vote}
            className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                mine > 0
                    ? 'border-transparent bg-skrum-primary-soft text-skrum-primary-text'
                    : 'border-input bg-card text-foreground hover:bg-accent',
                isVoteBlocked && 'cursor-not-allowed opacity-60',
            )}
        >
            <ThumbsUp className="size-4" aria-hidden />
            {total !== null && (
                <span data-slot="vote-count" aria-hidden>
                    {total}
                </span>
            )}
        </button>
    );

    return (
        <div
            data-slot="card-votes"
            onKeyDown={handleKeyDown}
            className={cn('flex min-w-0 items-center gap-2', className)}
        >
            {mine > 0 && (
                <span
                    data-slot="my-votes"
                    role="img"
                    aria-label={t('Your votes: :count', { count: mine })}
                    className="flex min-w-0 flex-wrap items-center gap-1"
                >
                    {Array.from({ length: mine }, (_, index) => (
                        <VoteDot
                            key={index}
                            filled
                            pop={index === poppedIndex}
                        />
                    ))}
                </span>
            )}
            <span className="grow" />
            {mine > 0 && !isClosed && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('Remove a vote')}
                            onClick={unvoteFromButton}
                        >
                            <Minus aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{`${t('Remove a vote')} (Shift+V)`}</TooltipContent>
                </Tooltip>
            )}
            {total === null && (
                <span
                    data-slot="hidden-total"
                    aria-label={t('Total hidden until reveal')}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-input bg-card/70 pr-2.5 pl-2 text-xs font-semibold text-muted-foreground"
                >
                    <EyeOff className="size-3.5" aria-hidden />
                    <span className="truncate">{t('Total hidden')}</span>
                </span>
            )}
            {total !== null && (
                <span data-slot="vote-total" className="sr-only">
                    {total === 1
                        ? t(':count vote', { count: total })
                        : t(':count votes', { count: total })}
                </span>
            )}
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        ref={wrapperRef}
                        data-slot="vote-button-wrapper"
                        role={isVoteBlocked ? 'group' : undefined}
                        aria-label={isVoteBlocked ? blockedReason : undefined}
                        tabIndex={isVoteBlocked ? 0 : undefined}
                        className="inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {voteButton}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    {isVoteBlocked ? blockedReason : `${t('Vote')} (V)`}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
