import { CircleSlash, Lock, Minus, Plus, Vote } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { cn } from '@/lib/utils';

export type VoteBudgetProps = {
    total: number;
    remaining: number;
    /** Said after the dots, in a quieter voice: "of 5", a rule of the vote. */
    detail?: ReactNode;
    className?: string;
};

export type VoteStepperProps = {
    mine: number;
    total: number | null;
    canVote: boolean;
    canUnvote: boolean;
    /** Why no vote can be added, read on "+" while `canVote` is false. */
    blockedReason?: string;
    /** Names "+" in place of "Add a vote". */
    addLabel?: string;
    /**
     * False leaves out the lock of a null total, where something else already
     * says that totals are hidden.
     */
    hiddenTotalNote?: boolean;
    onVote: () => void;
    onUnvote: () => void;
};

export type CardVotesProps = Pick<
    VoteStepperProps,
    'mine' | 'total' | 'hiddenTotalNote' | 'onVote' | 'onUnvote'
> & {
    maxPerCard?: number;
    budgetLeft: number;
    /**
     * Why nobody may vote here now (a closed board). "+" is off with this
     * reason and no vote can be taken back.
     */
    disabledReason?: string;
    className?: string;
};

const stepButtonClass =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-md:size-11';

const voteAloneClass =
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-md:h-11 max-md:min-w-11';

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
            className={cn(
                'inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-card',
                isEmpty ? 'text-muted-foreground' : 'text-foreground',
                className,
            )}
        >
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span aria-hidden className="truncate">
                {label}
            </span>
            <span className="sr-only">
                {isEmpty ? label : leftOfTotalLabel}
            </span>
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

/**
 * The votes of a card: its total, then mine as a stepper. With none of mine
 * the stepper is "+ Vote" alone; with some it is "− n +" in the primary tone.
 * "+" stays focusable while it is off, so its reason can be read.
 */
export function VoteStepper({
    mine,
    total,
    canVote,
    canUnvote,
    blockedReason,
    addLabel,
    hiddenTotalNote = true,
    onVote,
    onUnvote,
}: VoteStepperProps) {
    const { t } = useTrans();
    const reasonId = useId();
    const addRef = useRef<HTMLButtonElement>(null);
    const [previousMine, setPreviousMine] = useState(mine);
    const [popped, setPopped] = useState(false);

    if (mine !== previousMine) {
        setPreviousMine(mine);
        setPopped(mine > previousMine);
    }

    const hasMine = mine > 0;
    const reason = canVote ? undefined : blockedReason;
    const shortcutsShown = singleKeyShortcutsEnabled();
    const totalLabel =
        total === null
            ? t('Total hidden until reveal')
            : t(total === 1 ? ':count vote' : ':count votes', {
                  count: total,
              });

    /** Taking the last vote back removes the button that was pressed. */
    function unvote(): void {
        onUnvote();

        if (mine <= 1) {
            addRef.current?.focus();
        }
    }

    return (
        <>
            {(total !== null || hiddenTotalNote) && (
                <span
                    role="img"
                    data-slot={total === null ? 'hidden-total' : 'vote-total'}
                    aria-label={totalLabel}
                    title={totalLabel}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums"
                >
                    {total === null ? (
                        <Lock className="size-3.5" aria-hidden />
                    ) : (
                        <>
                            <Vote className="size-3.5" aria-hidden />
                            {total}
                        </>
                    )}
                </span>
            )}
            <span
                data-slot="vote-stepper"
                data-mine={hasMine || undefined}
                className={cn(
                    'inline-flex shrink-0 items-center rounded-full',
                    hasMine &&
                        'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset',
                )}
            >
                {hasMine && canUnvote && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={t('Remove a vote')}
                                onClick={unvote}
                                className={stepButtonClass}
                            >
                                <Minus className="size-4" aria-hidden />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            shortcut={
                                shortcutsShown ? ['Shift', 'V'] : undefined
                            }
                        >
                            {t('Remove a vote')}
                        </TooltipContent>
                    </Tooltip>
                )}
                {hasMine && (
                    <span
                        role="status"
                        aria-live="polite"
                        data-slot="my-votes"
                        aria-label={t('Your votes: :count', { count: mine })}
                        className={cn(
                            'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                            !canUnvote && 'ps-3',
                        )}
                    >
                        <VoteDot key={mine} filled pop={popped} />
                        {mine}
                    </span>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            ref={addRef}
                            type="button"
                            data-slot="vote-button"
                            aria-label={addLabel ?? t('Add a vote')}
                            aria-disabled={!canVote || undefined}
                            aria-describedby={
                                reason === undefined ? undefined : reasonId
                            }
                            onClick={() => {
                                if (canVote) {
                                    onVote();
                                }
                            }}
                            className={
                                hasMine ? stepButtonClass : voteAloneClass
                            }
                        >
                            <Plus className="size-4" aria-hidden />
                            {!hasMine && <span aria-hidden>{t('Vote')}</span>}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        shortcut={canVote && shortcutsShown ? ['V'] : undefined}
                    >
                        {reason ?? t('Vote')}
                    </TooltipContent>
                </Tooltip>
                {reason !== undefined && (
                    <span id={reasonId} className="sr-only">
                        {reason}
                    </span>
                )}
            </span>
        </>
    );
}

/** The stepper of a line that knows the budget: it works out why "+" is off. */
export function CardVotes({
    mine,
    total,
    maxPerCard,
    budgetLeft,
    disabledReason,
    hiddenTotalNote,
    onVote,
    onUnvote,
    className,
}: CardVotesProps) {
    const { t } = useTrans();
    const isOutOfBudget = budgetLeft <= 0;
    const isAtCardLimit = maxPerCard !== undefined && mine >= maxPerCard;
    const isClosed = disabledReason !== undefined;
    const canVote = !isClosed && !isOutOfBudget && !isAtCardLimit;
    const canUnvote = !isClosed && mine > 0;
    const budgetReason = isOutOfBudget
        ? t('You have used all your votes')
        : t('You reached the limit of :max votes on this card', {
              max: maxPerCard ?? 0,
          });

    function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key !== 'v' && event.key !== 'V') {
            return;
        }

        if (event.repeat) {
            event.preventDefault();

            return;
        }

        if (!singleKeyShortcutsEnabled()) {
            return;
        }

        event.preventDefault();

        if (event.shiftKey && canUnvote) {
            onUnvote();
        }

        if (!event.shiftKey && canVote) {
            onVote();
        }
    }

    return (
        <div
            data-slot="card-votes"
            onKeyDown={handleKeyDown}
            className={cn(
                'flex min-w-0 items-center justify-end gap-2',
                className,
            )}
        >
            <VoteStepper
                mine={mine}
                total={total}
                canVote={canVote}
                canUnvote={canUnvote}
                blockedReason={disabledReason ?? budgetReason}
                hiddenTotalNote={hiddenTotalNote}
                onVote={onVote}
                onUnvote={onUnvote}
            />
        </div>
    );
}
