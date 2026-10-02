import { CircleCheck, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import type { AvatarStackProps } from '@/components/skrum/avatar-stack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type Roti = 1 | 2 | 3 | 4 | 5;

export type ROTIParticipant = AvatarStackProps['people'][number];

export interface ROTIResult {
    /** `null` while nobody has voted. */
    mean: number | null;
    votes: number;
    distribution: Record<Roti, number>;
    previousMean?: number;
    missing?: ROTIParticipant[];
}

export interface ROTIWidgetProps {
    mode: 'vote' | 'result';
    value?: Roti | null;
    onVote?: (value: Roti) => void;
    result?: ROTIResult;
    canClose?: boolean;
    onClose?: () => void;
    /** Results stay hidden below this number of votes. The server sends the average for any count. */
    minimumRespondents?: number;
    labels?: { question?: string };
    className?: string;
}

const scale: Roti[] = [1, 2, 3, 4, 5];

const rotiBackground: Record<Roti, string> = {
    1: 'bg-skrum-roti-1',
    2: 'bg-skrum-roti-2',
    3: 'bg-skrum-roti-3',
    4: 'bg-skrum-roti-4',
    5: 'bg-skrum-roti-5',
};

function useRotiLabels(): Record<Roti, string> {
    const { t } = useTrans();

    return {
        1: t('Waste of time'),
        2: t('Not very useful'),
        3: t('Okay'),
        4: t('Useful'),
        5: t('Excellent'),
    };
}

function formatDecimal(value: number, digits = 1): string {
    const locale = document.documentElement.lang || undefined;

    return value.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function RotiBadge({ value, className }: { value: Roti; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-skrum-roti-foreground',
                rotiBackground[value],
                className,
            )}
        >
            {value}
        </span>
    );
}

function VotePanel({
    value,
    onVote,
    labels: overrides,
}: Pick<ROTIWidgetProps, 'value' | 'onVote' | 'labels'>) {
    const { t } = useTrans();
    const labels = useRotiLabels();
    const questionId = useId();
    const optionRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const focusable: Roti = value ?? 1;

    function choose(next: Roti, focus: boolean) {
        if (focus) {
            optionRefs.current[next]?.focus();
        }

        onVote?.(next);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
        ) {
            return;
        }

        if (
            !(event.target instanceof Node) ||
            !event.currentTarget.contains(event.target)
        ) {
            return;
        }

        if (/^[1-5]$/.test(event.key)) {
            event.preventDefault();
            choose(Number(event.key) as Roti, true);

            return;
        }

        const step =
            event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? -1
                  : 0;

        if (step === 0) {
            return;
        }

        event.preventDefault();
        const next = (((focusable - 1 + step + 5) % 5) + 1) as Roti;
        choose(next, true);
    }

    return (
        <>
            <p
                id={questionId}
                className="text-ui-lg font-semibold text-card-foreground"
            >
                {overrides?.question ?? t('How was this retro?')}
            </p>
            <div
                role="radiogroup"
                aria-labelledby={questionId}
                data-slot="roti-options"
                onKeyDown={handleKeyDown}
                className="flex flex-col gap-1.5"
            >
                {scale.map((rating) => {
                    const checked = value === rating;

                    return (
                        <button
                            key={rating}
                            ref={(node) => {
                                optionRefs.current[rating] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={rating === focusable ? 0 : -1}
                            data-rating={rating}
                            onClick={() => choose(rating, false)}
                            className={cn(
                                'flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm font-medium transition-colors duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                checked &&
                                    'border-foreground ring-1 ring-foreground',
                            )}
                        >
                            <RotiBadge value={rating} />
                            <span className="truncate">{labels[rating]}</span>
                        </button>
                    );
                })}
            </div>
            {value != null && (
                <p
                    role="status"
                    className="flex items-center gap-3 rounded-md bg-skrum-success-soft px-3 py-2.5 text-body-sm font-semibold text-skrum-success-text"
                >
                    <CircleCheck className="size-4 shrink-0" aria-hidden />
                    <span>
                        {t(
                            'Vote recorded. You can change it until the ROTI is closed.',
                        )}
                    </span>
                </p>
            )}
        </>
    );
}

function TrendBadge({ delta }: { delta: number }) {
    const { t } = useTrans();
    const rounded = Math.round(delta * 10) / 10;

    if (rounded === 0) {
        return (
            <Badge variant="secondary" shape="pill" className="shrink-0">
                <Minus aria-hidden />
                {t('Unchanged vs previous sprint')}
            </Badge>
        );
    }

    const up = rounded > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    const signed = `${up ? '+' : '−'}${formatDecimal(Math.abs(rounded))}`;

    return (
        <Badge
            variant={up ? 'success' : 'destructive'}
            shape="pill"
            className="shrink-0"
        >
            <Icon aria-hidden />
            {t(':delta vs previous sprint', { delta: signed })}
        </Badge>
    );
}

function ResultPanel({
    result,
    canClose,
    onClose,
    minimumRespondents = 0,
}: Pick<
    ROTIWidgetProps,
    'result' | 'canClose' | 'onClose' | 'minimumRespondents'
>) {
    const { t } = useTrans();
    const labels = useRotiLabels();

    if (!result) {
        return null;
    }

    const mean = result.mean;
    const revealed = mean !== null && result.votes >= minimumRespondents;
    const missing = result.missing ?? [];
    const maxCount = Math.max(1, ...scale.map((r) => result.distribution[r]));
    const breakdownLabel = scale
        .map((r) =>
            t(':rating: :count', {
                rating: r,
                count: result.distribution[r],
            }),
        )
        .join(', ');

    return (
        <>
            {revealed && mean !== null ? (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex min-w-0 items-center gap-4">
                            <span
                                data-slot="roti-mean"
                                className="font-display text-display-xl font-bold tracking-tight"
                            >
                                {formatDecimal(mean)}
                                <small className="ml-1 text-lg font-semibold tracking-normal text-muted-foreground">
                                    {t('/ 5')}
                                </small>
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-bold">
                                    {t('Average ROTI')}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {result.votes === 1
                                        ? t(':count vote', {
                                              count: result.votes,
                                          })
                                        : t(':count votes', {
                                              count: result.votes,
                                          })}
                                </span>
                            </span>
                        </div>
                        {result.previousMean !== undefined && (
                            <TrendBadge delta={mean - result.previousMean} />
                        )}
                    </div>
                    <div
                        role="img"
                        aria-label={`${t('Distribution')}: ${breakdownLabel}`}
                        data-slot="roti-stack"
                        className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted"
                    >
                        {scale
                            .filter((r) => result.distribution[r] > 0)
                            .map((r) => (
                                <span
                                    key={r}
                                    className={cn('block', rotiBackground[r])}
                                    style={{ flex: result.distribution[r] }}
                                />
                            ))}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                        {[...scale].reverse().map((r) => (
                            <li
                                key={r}
                                data-rating={r}
                                className="grid grid-cols-[1.5rem_minmax(0,7.5rem)_1fr_1.5rem] items-center gap-3 text-body-sm @max-card-narrow/card:grid-cols-[1.5rem_1fr_1.5rem]"
                            >
                                <RotiBadge
                                    value={r}
                                    className="size-6 text-body-sm"
                                />
                                <span className="truncate">{labels[r]}</span>
                                <span
                                    aria-hidden
                                    className="h-2.5 overflow-hidden rounded-full bg-muted @max-card-narrow/card:hidden"
                                >
                                    <span
                                        className={cn(
                                            'block h-full rounded-full',
                                            rotiBackground[r],
                                        )}
                                        style={{
                                            width: `${(result.distribution[r] / maxCount) * 100}%`,
                                        }}
                                    />
                                </span>
                                <b className="text-right tabular-nums">
                                    {result.distribution[r]}
                                </b>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p
                    role="status"
                    data-slot="roti-hidden"
                    className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground"
                >
                    {result.votes < minimumRespondents
                        ? t(
                              'Results appear once :minimum people have voted. :count so far.',
                              {
                                  minimum: minimumRespondents,
                                  count: result.votes,
                              },
                          )
                        : t('Nobody has voted yet.')}
                </p>
            )}
            {(missing.length > 0 || (canClose && onClose)) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4 text-body-sm text-muted-foreground">
                    {missing.length > 0 && (
                        <>
                            <AvatarStack people={missing} size="sm" />
                            <span className="min-w-0">
                                {missing.length === 1
                                    ? t(':count participant has not voted', {
                                          count: missing.length,
                                      })
                                    : t(':count participants have not voted', {
                                          count: missing.length,
                                      })}
                            </span>
                        </>
                    )}
                    {canClose && onClose && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="ml-auto min-w-0"
                            onClick={onClose}
                        >
                            <span className="truncate">
                                {t('Close the ROTI')}
                            </span>
                        </Button>
                    )}
                </div>
            )}
        </>
    );
}

export function ROTIWidget({
    mode,
    value,
    onVote,
    result,
    canClose,
    onClose,
    minimumRespondents,
    labels,
    className,
}: ROTIWidgetProps) {
    return (
        <Card
            data-slot="roti-widget"
            data-mode={mode}
            className={cn('gap-4 p-5', className)}
        >
            {mode === 'vote' ? (
                <VotePanel value={value} onVote={onVote} labels={labels} />
            ) : (
                <ResultPanel
                    result={result}
                    canClose={canClose}
                    onClose={onClose}
                    minimumRespondents={minimumRespondents}
                />
            )}
        </Card>
    );
}
