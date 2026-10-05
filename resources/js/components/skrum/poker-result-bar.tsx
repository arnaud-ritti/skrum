import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import { PokerDeck } from '@/components/skrum/poker-card';
import {
    agreementOf,
    discussionSentence,
    formatNumber,
    hasCountableVotes,
    PokerDistribution,
    showsAverage,
} from '@/components/skrum/poker-table';
import type {
    PokerResult,
    PokerSeat,
    PokerStory,
    PokerValue,
} from '@/components/skrum/poker-table';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PokerRevealReason } from '@/lib/poker/types';
import { cn } from '@/lib/utils';

export type PokerResultLayout = 'bar' | 'card' | 'foot';

export interface PokerResultBarProps {
    /**
     * `bar` (default): everything on one line, where the deck was. On a phone
     * the result is split in two: `card` is the result in the flow of the
     * page, with the final-estimate cards, and `foot` the two buttons that
     * stay at the bottom.
     */
    layout?: PokerResultLayout;
    /** null when the round is revealed and the server sent no result yet. */
    result?: PokerResult | null;
    /** The seats name the extremes of a round that is not anonymous. */
    seats?: PokerSeat[];
    story: PokerStory;
    anonymous?: boolean;
    revealReason?: PokerRevealReason | null;
    locale?: string;
    /** false on a deck without numbers: no nearest card is named. */
    isNumeric?: boolean;
    /** Id of the heading that names the section; generated when absent. */
    headingId?: string;
    /** The section takes focus (tabindex -1) when the votes are revealed. */
    sectionRef?: Ref<HTMLElement>;
    /** What the viewer played, at the end of the heading line. */
    status?: ReactNode;
    isFacilitator?: boolean;
    busy?: boolean;
    /** The chosen final estimate; empty when none can be proposed. */
    estimate?: PokerValue | null;
    /** The cards a final estimate is chosen from. */
    estimateValues?: PokerValue[];
    /** A next task waits: validating also moves on to it. */
    hasNext?: boolean;
    onEstimateChange?: (value: PokerValue) => void;
    onValidate?: (value: PokerValue) => void;
    onRevote?: () => void;
    className?: string;
}

const DistributionRem = 3;

/**
 * A busy action keeps its focus: a native `disabled` would drop the focus of
 * the button that was just pressed.
 */
const busyAction = 'cursor-not-allowed opacity-50';

type ButtonsProps = Pick<
    PokerResultBarProps,
    'busy' | 'estimate' | 'hasNext' | 'onValidate' | 'onRevote'
> & {
    /** Phone: Re-vote is an icon before the main button, which takes the width. */
    inline?: boolean;
};

function ResultButtons({
    busy = false,
    estimate,
    hasNext = false,
    inline = false,
    onValidate,
    onRevote,
}: ButtonsProps) {
    const { t } = useTrans();
    const reasonId = useId();
    const value = estimate ?? '';
    const isMissing = value === '';
    const validateLabel = isMissing
        ? hasNext
            ? t('Validate · Next story')
            : t('Validate')
        : hasNext
          ? t('Validate :value · Next story', { value })
          : t('Validate :value', { value });

    return (
        <div
            className={cn(
                'flex min-w-0 gap-2',
                inline
                    ? 'w-full flex-row-reverse items-center'
                    : 'shrink-0 flex-col items-stretch',
            )}
        >
            {onValidate && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            size="lg"
                            data-test="poker-validate"
                            className={cn(
                                'max-w-full min-w-0',
                                inline && 'flex-1',
                                (busy || isMissing) && busyAction,
                            )}
                            aria-disabled={busy || isMissing || undefined}
                            aria-describedby={isMissing ? reasonId : undefined}
                            onClick={() => {
                                if (!busy && !isMissing) {
                                    onValidate(value);
                                }
                            }}
                        >
                            <span className="truncate">{validateLabel}</span>
                            {hasNext ? (
                                <ArrowRight aria-hidden />
                            ) : (
                                <Check aria-hidden />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent
                        shortcut={inline ? undefined : ['⌘/Ctrl', '↵']}
                    >
                        {validateLabel}
                    </TooltipContent>
                </Tooltip>
            )}
            {onValidate && isMissing && (
                <span id={reasonId} className="sr-only">
                    {t('Choose an estimate first.')}
                </span>
            )}
            {onRevote && (
                <Button
                    type="button"
                    size={inline ? 'icon-lg' : 'sm'}
                    variant="outline"
                    aria-label={inline ? t('Re-vote') : undefined}
                    className={cn(
                        'min-w-0',
                        inline ? 'shrink-0' : 'max-w-full',
                        busy && busyAction,
                    )}
                    aria-disabled={busy || undefined}
                    onClick={() => {
                        if (!busy) {
                            onRevote();
                        }
                    }}
                >
                    <RotateCcw aria-hidden />
                    {!inline && (
                        <span className="truncate">{t('Re-vote')}</span>
                    )}
                </Button>
            )}
        </div>
    );
}

/**
 * The result of a revealed round where the deck was (ScreenPokerAfter): the
 * agreement, the distribution and who opens the discussion, then, for the
 * facilitator, the final-estimate cards and the button that validates the
 * estimate. The average and the median of the oval of `PokerTable` are
 * repeated here, as the mockup does; the spread stays in the oval.
 */
export function PokerResultBar({
    layout = 'bar',
    result,
    seats = [],
    story,
    anonymous = false,
    revealReason,
    locale,
    isNumeric,
    headingId,
    sectionRef,
    status,
    isFacilitator = false,
    busy = false,
    estimate,
    estimateValues = [],
    hasNext = false,
    onEstimateChange,
    onValidate,
    onRevote,
    className,
}: PokerResultBarProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const cardsRef = useRef<HTMLDivElement>(null);
    const titleId = headingId ?? generatedId;
    const value = estimate ?? '';
    const isCard = layout === 'card';
    const voteCount = (result?.distribution ?? []).reduce(
        (sum, entry) => sum + entry.count,
        0,
    );
    const countable = !!result && hasCountableVotes(result);
    const agreement = result ? agreementOf(t, result) : null;
    // The oval of the table holds the average and the median too: the dock
    // repeats them because the oval can be under the fold of a short screen.
    const stats: { label: string; value: string }[] = [];

    if (result && countable) {
        if (showsAverage(result, isNumeric) && result.average !== null) {
            stats.push({
                label: t('Average'),
                value: formatNumber(result.average, locale),
            });
        }

        if (result.median !== undefined && result.median !== null) {
            stats.push({
                label: t('Median'),
                value: formatNumber(result.median, locale),
            });
        }

        if (agreement !== null) {
            stats.push({ label: t('Agreement'), value: agreement });
        }
    }

    const sentence =
        result && countable
            ? discussionSentence(t, result, seats, story, anonymous, locale)
            : null;
    const hasButtons = isFacilitator && (!!onValidate || !!onRevote);
    const hasCards =
        isFacilitator && !!onEstimateChange && estimateValues.length > 0;
    const buttons = (
        <ResultButtons
            busy={busy}
            estimate={estimate}
            hasNext={hasNext}
            inline={layout === 'foot'}
            onValidate={onValidate}
            onRevote={onRevote}
        />
    );

    // A long deck scrolls: the chosen card is brought into the row.
    useEffect(() => {
        const row = cardsRef.current?.querySelector<HTMLElement>(
            '[data-slot="poker-deck"]',
        );
        const chosen = row?.querySelector<HTMLElement>('[aria-checked="true"]');

        if (!row || !chosen) {
            return;
        }

        row.scrollLeft =
            chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2;
    }, [value, hasCards, layout]);

    if (layout === 'foot') {
        if (!hasButtons) {
            return null;
        }

        return (
            <div
                role="group"
                aria-label={t('Facilitator tools')}
                data-slot="poker-actions"
                className={cn('flex w-full min-w-0', className)}
            >
                {buttons}
            </div>
        );
    }

    const cards = hasCards && (
        <div
            ref={cardsRef}
            className={cn(
                'flex min-w-0 flex-col gap-1',
                !isCard && 'flex-1 basis-56',
            )}
        >
            <span
                aria-hidden
                className="text-xs font-semibold text-muted-foreground"
            >
                {t('Final estimate')}
            </span>
            <PokerDeck
                values={estimateValues}
                value={value === '' ? null : value}
                size="sm"
                selection="radio"
                label={t('Final estimate')}
                cardLabel={(card) => card}
                className="relative max-w-full flex-nowrap justify-start overflow-x-auto px-1 pt-3 pb-1"
                onChange={onEstimateChange}
            />
        </div>
    );

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            data-slot="poker-result"
            data-layout={layout}
            data-consensus={result?.consensus}
            className={cn(
                'flex w-full min-w-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCard
                    ? 'gap-3 rounded-xl border border-border bg-card p-4 shadow-card'
                    : 'gap-2 rounded-md',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <h3
                    id={titleId}
                    className="min-w-0 font-semibold text-foreground"
                >
                    {result
                        ? t(
                              voteCount === 1
                                  ? 'Result · :count vote'
                                  : 'Result · :count votes',
                              { count: voteCount },
                          )
                        : t('Votes revealed')}
                </h3>
                {isNumeric !== false &&
                    result != null &&
                    result.average !== null &&
                    result.nearestCard !== null && (
                        <span className="min-w-0">
                            {t('Nearest card: :card', {
                                card: result.nearestCard,
                            })}
                        </span>
                    )}
                {revealReason === 'everyone_voted' && (
                    <span className="min-w-0">
                        {t('Revealed automatically — everyone voted')}
                    </span>
                )}
                {revealReason === 'timer' && (
                    <span className="min-w-0">
                        {t("Revealed automatically — time's up")}
                    </span>
                )}
                <span className="flex-1" />
                {status}
            </div>
            <div
                className={cn(
                    'flex min-w-0 gap-x-8 gap-y-3',
                    isCard ? 'flex-col' : 'flex-wrap items-end',
                )}
            >
                {result && (
                    <div
                        className={cn(
                            'flex min-w-0 flex-col gap-1',
                            !isCard && 'max-w-xs flex-1 basis-48',
                        )}
                    >
                        {stats.length > 0 && (
                            <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1">
                                {stats.map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="flex max-w-full min-w-0 flex-col"
                                    >
                                        <dt className="order-2 text-xs text-muted-foreground">
                                            {stat.label}
                                        </dt>
                                        <dd className="order-1 truncate font-display text-xl font-bold text-foreground">
                                            {stat.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        {!countable && (
                            <p className="text-sm text-muted-foreground">
                                {t('No countable votes')}
                            </p>
                        )}
                        {sentence !== null && (
                            <p
                                data-slot="poker-result-next"
                                className="text-sm text-muted-foreground"
                            >
                                {sentence}
                            </p>
                        )}
                    </div>
                )}
                {result && (
                    <PokerDistribution
                        result={result}
                        maxRem={DistributionRem}
                    />
                )}
                {isCard && cards}
                {!isCard && (hasCards || hasButtons) && (
                    <div
                        role="group"
                        aria-label={t('Facilitator tools')}
                        data-slot="poker-actions"
                        className="flex min-w-0 flex-2 basis-md flex-wrap items-end gap-x-6 gap-y-3"
                    >
                        {cards}
                        {hasButtons && buttons}
                    </div>
                )}
            </div>
        </section>
    );
}
