import {
    CircleCheck,
    EyeOff,
    Minus,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import type { AvatarStackProps } from '@/components/skrum/avatar-stack';
import { rotiBackground } from '@/components/skrum/roti-value';
import type { RotiStep } from '@/components/skrum/roti-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { formatDecimal } from '@/lib/surveys/format';
import { cn } from '@/lib/utils';

export type Roti = RotiStep;

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
    labels?: {
        question?: string;
        /** Said once the viewer has voted. */
        saved?: string;
    };
    /**
     * `row` is the vote of the ROTI screen: the five scores side by side,
     * each number above its label. `list` stacks them, for a narrow panel.
     */
    layout?: 'list' | 'row';
    /** Vote mode: a line above the question. */
    eyebrow?: string;
    /** Vote mode: what follows the confirmation, inside the card. */
    footer?: ReactNode;
    className?: string;
}

const scale: Roti[] = [1, 2, 3, 4, 5];

function useRotiLabels(): Record<Roti, string> {
    const { t } = useTrans();

    return {
        1: t('Waste of time'),
        2: t('Not very useful'),
        3: t('OK'),
        4: t('Useful'),
        5: t('Excellent'),
    };
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
    layout = 'list',
    eyebrow,
    footer,
}: Pick<
    ROTIWidgetProps,
    'value' | 'onVote' | 'labels' | 'layout' | 'eyebrow' | 'footer'
>) {
    const { t } = useTrans();
    const labels = useRotiLabels();
    const question =
        overrides?.question ?? t('Was this time together worth it?');
    const optionRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const [focusedRating, setFocusedRating] = useState<Roti | null>(null);
    const focusable: Roti = focusedRating ?? value ?? 1;
    const isRow = layout === 'row';

    function choose(next: Roti) {
        optionRefs.current[next]?.focus();
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

        if (
            /^[1-5]$/.test(event.key) &&
            onVote !== undefined &&
            singleKeyShortcutsEnabled()
        ) {
            event.preventDefault();
            choose(Number(event.key) as Roti);

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

        const current = Number(
            (event.target as Element)
                .closest('[data-rating]')
                ?.getAttribute('data-rating') ?? focusable,
        );

        event.preventDefault();
        optionRefs.current[((current - 1 + step + 5) % 5) + 1]?.focus();
    }

    return (
        <>
            {isRow ? (
                <div className="flex min-w-0 flex-col gap-2">
                    {eyebrow && (
                        <span
                            data-slot="roti-eyebrow"
                            className="text-overline text-muted-foreground uppercase"
                        >
                            {eyebrow}
                        </span>
                    )}
                    <h2 className="font-display text-2xl font-title tracking-tight text-card-foreground">
                        {question}
                    </h2>
                </div>
            ) : (
                <>
                    {eyebrow && (
                        <span
                            data-slot="roti-eyebrow"
                            className="text-overline text-muted-foreground uppercase"
                        >
                            {eyebrow}
                        </span>
                    )}
                    <p className="text-ui-lg font-semibold text-card-foreground">
                        {question}
                    </p>
                </>
            )}
            <div
                role="group"
                aria-label={question}
                data-slot="roti-options"
                data-layout={layout}
                onKeyDown={handleKeyDown}
                className={
                    isRow
                        ? 'grid grid-cols-5 gap-1.5 @lg/card:gap-2'
                        : 'flex flex-col gap-1.5'
                }
            >
                {scale.map((rating) => {
                    const pressed = value === rating;

                    return (
                        <button
                            key={rating}
                            ref={(node) => {
                                optionRefs.current[rating] = node;
                            }}
                            type="button"
                            aria-pressed={pressed}
                            tabIndex={rating === focusable ? 0 : -1}
                            data-rating={rating}
                            onFocus={() => setFocusedRating(rating)}
                            onClick={() => onVote?.(rating)}
                            className={cn(
                                'flex min-w-0 rounded-lg border bg-card transition-colors duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                isRow
                                    ? 'min-h-11 flex-col items-center gap-2 px-0.5 pt-4 pb-3 text-center text-overline font-semibold tracking-normal text-muted-foreground @lg/card:px-1 @lg/card:text-body-sm/4'
                                    : 'items-center gap-3 px-3 py-2 text-left text-sm font-medium',
                                pressed &&
                                    'border-foreground text-foreground ring-1 ring-foreground',
                            )}
                        >
                            <RotiBadge
                                value={rating}
                                className={
                                    isRow
                                        ? 'size-9 text-lg @card-narrow/card:size-12 @card-narrow/card:text-xl'
                                        : undefined
                                }
                            />
                            <span
                                className={
                                    isRow
                                        ? 'max-w-full wrap-anywhere hyphens-auto'
                                        : 'truncate'
                                }
                            >
                                {labels[rating]}
                            </span>
                        </button>
                    );
                })}
            </div>
            <p
                role="status"
                className={
                    value != null
                        ? 'flex items-center gap-3 rounded-md bg-skrum-success-soft px-3 py-2.5 text-body-sm font-semibold text-skrum-success-text'
                        : 'sr-only'
                }
            >
                {value != null && (
                    <>
                        <CircleCheck className="size-4 shrink-0" aria-hidden />
                        <span>
                            {overrides?.saved ??
                                t(
                                    'Vote recorded. You can change it until the ROTI is closed.',
                                )}
                        </span>
                    </>
                )}
            </p>
            {footer}
        </>
    );
}

/**
 * The distribution while nobody may see it: a striped bar and the five
 * scores, each with a question mark. It never holds a number.
 */
export function ROTIHiddenDistribution({
    title,
    note,
    className,
}: {
    title: string;
    note?: string;
    className?: string;
}) {
    const { t } = useTrans();

    return (
        <div
            data-slot="roti-hidden-distribution"
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-lg border border-dashed border-input p-4',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <EyeOff className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0">{title}</span>
                </span>
                {note && (
                    <span className="min-w-0 text-xs text-muted-foreground">
                        {note}
                    </span>
                )}
            </div>
            <div
                role="img"
                aria-label={t('Distribution hidden')}
                className="bg-stripes h-3.5 rounded-full"
            />
            <div aria-hidden className="grid grid-cols-5 gap-2">
                {scale.map((rating) => (
                    <span
                        key={rating}
                        className="flex h-7 min-w-0 items-center justify-center gap-1 rounded-sm bg-muted text-xs font-bold text-muted-foreground"
                    >
                        <RotiBadge
                            value={rating}
                            className="size-4.5 text-overline font-bold tracking-normal"
                        />
                        ?
                    </span>
                ))}
            </div>
        </div>
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
}: Pick<ROTIWidgetProps, 'result' | 'canClose' | 'onClose'>) {
    const { t } = useTrans();
    const labels = useRotiLabels();

    if (!result) {
        return null;
    }

    const mean = result.mean;
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
            {mean !== null ? (
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
                        aria-label={t('Distribution: :breakdown', {
                            breakdown: breakdownLabel,
                        })}
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
                    {t('Nobody has voted yet.')}
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
    labels,
    layout = 'list',
    eyebrow,
    footer,
    className,
}: ROTIWidgetProps) {
    return (
        <Card
            data-slot="roti-widget"
            data-mode={mode}
            className={cn(
                mode === 'vote' && layout === 'row' ? 'gap-5 p-6' : 'gap-4 p-5',
                className,
            )}
        >
            {mode === 'vote' ? (
                <VotePanel
                    value={value}
                    onVote={onVote}
                    labels={labels}
                    layout={layout}
                    eyebrow={eyebrow}
                    footer={footer}
                />
            ) : (
                <ResultPanel
                    result={result}
                    canClose={canClose}
                    onClose={onClose}
                />
            )}
        </Card>
    );
}
