import {
    ArrowRight,
    Check,
    CircleCheck,
    Eye,
    RotateCcw,
    Split,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useShortcut } from '@/hooks/use-shortcut';
import type { Participant } from '@/components/skrum/presence-stack';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type PokerValue = string;

export interface PokerSeat {
    user: Participant;
    state: 'waiting' | 'voted' | 'absent';
    value?: PokerValue;
}

export interface PokerResult {
    mean: number | null;
    median: number | null;
    mode: PokerValue;
    agreement: number;
    consensus: boolean;
    distribution: { value: PokerValue; count: number }[];
    outliers: string[];
}

export interface PokerStory {
    key?: string;
    title: string;
    url?: string;
}

export interface PokerTableProps {
    story: PokerStory;
    seats: PokerSeat[];
    revealed: boolean;
    result?: PokerResult;
    isFacilitator?: boolean;
    onReveal?: () => void;
    onRevote?: () => void;
    onAccept?: (value: PokerValue) => void;
    onNext?: () => void;
    className?: string;
}

const MaxOvalSeats = 12;
const CascadeStepMs = 40;
const CascadeMaxMs = 400;
const DistributionMaxRem = 4.5;
const DistributionMinRem = 0.25;

function formatNumber(value: number | null): string {
    if (value === null) {
        return '–';
    }

    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function storyLabel(story: PokerStory): string {
    return story.key ? `${story.key} · ${story.title}` : story.title;
}

function splitSeats(count: number): {
    top: number[];
    left: number[];
    right: number[];
    bottom: number[];
} {
    const perSide = count >= 10 ? 2 : count >= 4 ? 1 : 0;
    const remaining = count - perSide * 2;
    const topCount = Math.ceil(remaining / 2);
    const indices = Array.from({ length: count }, (_, index) => index);

    return {
        top: indices.slice(0, topCount),
        left: indices.slice(topCount, topCount + perSide),
        right: indices.slice(topCount + perSide, topCount + perSide * 2),
        bottom: indices.slice(topCount + perSide * 2),
    };
}

function PokerCardSlot({
    seat,
    revealed,
    outlier,
    index,
}: {
    seat: PokerSeat;
    revealed: boolean;
    outlier: boolean;
    index: number;
}) {
    const hasCard = seat.state === 'voted';
    const isSpecial = seat.value === '☕' || seat.value === '?';

    if (!hasCard) {
        return (
            <span
                aria-hidden
                data-slot="poker-card"
                data-face="empty"
                className="block h-14 w-10 rounded-md border-2 border-dashed border-input"
            />
        );
    }

    return (
        <span
            aria-hidden
            data-slot="poker-card"
            data-face={revealed ? 'up' : 'down'}
            data-outlier={outlier || undefined}
            className="block h-14 w-10"
            style={{ perspective: '37.5rem' }}
        >
            <span
                className="flip-3d relative block size-full"
                style={{
                    transform: revealed ? 'rotateY(0deg)' : 'rotateY(180deg)',
                    transitionDelay: revealed
                        ? `${Math.min(index * CascadeStepMs, CascadeMaxMs)}ms`
                        : '0ms',
                }}
            >
                <span
                    className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-md border border-border bg-card font-display text-lg font-bold shadow-card backface-hidden',
                        isSpecial
                            ? 'text-muted-foreground'
                            : 'text-secondary-foreground',
                        outlier && 'ring-2 ring-skrum-warning',
                    )}
                >
                    {revealed ? seat.value : null}
                </span>
                <span
                    className="absolute inset-0 rounded-md border border-primary bg-primary shadow-card backface-hidden"
                    style={{ transform: 'rotateY(180deg)' }}
                />
            </span>
        </span>
    );
}

function Trema() {
    return (
        <span aria-hidden className="inline-flex items-center gap-0.5">
            <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
            <i
                className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none"
                style={{ animationDelay: '150ms' }}
            />
        </span>
    );
}

function SeatView({
    seat,
    index,
    revealed,
    outlier,
    reverse,
}: {
    seat: PokerSeat;
    index: number;
    revealed: boolean;
    outlier: boolean;
    reverse?: boolean;
}) {
    const { t } = useTrans();
    const name = seat.user.isMe ? t('You') : seat.user.name;
    const hasShownValue = revealed && seat.state === 'voted';
    const value = seat.value ?? '–';
    const label = hasShownValue
        ? outlier
            ? t(':name, :value, worth discussing', { name, value })
            : t(':name, :value', { name, value })
        : seat.state === 'voted'
          ? t(':name, voted', { name })
          : seat.state === 'absent'
            ? t(':name, absent', { name })
            : t(':name, thinking', { name });

    return (
        <div
            role="group"
            aria-label={label}
            data-slot="poker-seat"
            data-state={seat.state}
            className={cn(
                'flex w-16 min-w-0 flex-col items-center gap-1.5',
                reverse && 'flex-col-reverse',
                seat.state === 'absent' && 'opacity-60',
            )}
        >
            <PokerCardSlot
                seat={seat}
                revealed={revealed}
                outlier={outlier}
                index={index}
            />
            <span className="inline-flex max-w-full items-center gap-1 text-xs font-medium whitespace-nowrap text-foreground">
                <PersonAvatar
                    name={seat.user.name}
                    size="xs"
                    decorative
                    presence={
                        seat.user.presence >= 1 && seat.user.presence <= 12
                            ? (seat.user.presence as AvatarPresence)
                            : undefined
                    }
                />
                <span className="truncate">{name}</span>
            </span>
            {!revealed && (
                <span
                    aria-hidden
                    className={cn(
                        'inline-flex items-center gap-1 text-overline whitespace-nowrap',
                        seat.state === 'voted'
                            ? 'text-skrum-success-text'
                            : 'text-muted-foreground',
                    )}
                >
                    {seat.state === 'voted' && (
                        <>
                            <Check className="size-3" />
                            {t('voted')}
                        </>
                    )}
                    {seat.state === 'waiting' && (
                        <>
                            <Trema />
                            {t('thinking')}
                        </>
                    )}
                    {seat.state === 'absent' && t('absent')}
                </span>
            )}
        </div>
    );
}

function ShortcutTooltip({
    shortcut,
    label,
    children,
}: {
    shortcut: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>{`${label} (${shortcut})`}</TooltipContent>
        </Tooltip>
    );
}

function TableCenter({
    story,
    seats,
    revealed,
    result,
    isFacilitator,
    onReveal,
}: Pick<
    PokerTableProps,
    'story' | 'seats' | 'revealed' | 'result' | 'isFacilitator' | 'onReveal'
>) {
    const { t } = useTrans();
    const voters = seats.filter((seat) => seat.state !== 'absent');
    const votedCount = voters.filter((seat) => seat.state === 'voted').length;
    const title = storyLabel(story);

    return (
        <div
            data-slot="poker-table-center"
            className="flex min-w-0 flex-col items-center gap-2 text-center"
        >
            {story.url ? (
                <a
                    href={story.url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full truncate rounded-sm text-body-sm font-semibold text-secondary-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {title}
                </a>
            ) : (
                <span className="max-w-full truncate text-body-sm font-semibold text-secondary-foreground">
                    {title}
                </span>
            )}
            {revealed ? (
                result && (
                    <>
                        <span className="text-xs text-secondary-foreground">
                            {t('Mean')}
                        </span>
                        <span
                            data-slot="poker-mean"
                            className="font-display text-display-lg font-bold text-secondary-foreground"
                        >
                            {formatNumber(result.mean)}
                        </span>
                        <ConsensusBadge consensus={result.consensus} />
                    </>
                )
            ) : (
                <>
                    <div className="w-36">
                        <Progress
                            value={votedCount}
                            max={Math.max(voters.length, 1)}
                            tone="primary"
                            aria-label={t('Voting progress')}
                        />
                    </div>
                    <span
                        role="status"
                        aria-live="polite"
                        data-slot="poker-progress"
                        className="text-xs text-secondary-foreground"
                    >
                        {t(':voted of :total voted', {
                            voted: votedCount,
                            total: voters.length,
                        })}
                    </span>
                    {isFacilitator && onReveal && (
                        <ShortcutTooltip shortcut="R" label={t('Reveal')}>
                            <Button type="button" size="sm" onClick={onReveal}>
                                <Eye aria-hidden />
                                {t('Reveal')}
                            </Button>
                        </ShortcutTooltip>
                    )}
                </>
            )}
        </div>
    );
}

function ConsensusBadge({
    consensus,
    children,
}: {
    consensus: boolean;
    children?: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <Badge
            variant={consensus ? 'success' : 'warning'}
            shape="pill"
            icon={consensus ? CircleCheck : Split}
            data-slot="poker-verdict"
        >
            {children ?? (consensus ? t('Consensus') : t('Needs discussion'))}
        </Badge>
    );
}

function Distribution({ result }: { result: PokerResult }) {
    const { t } = useTrans();
    const [asTable, setAsTable] = useState(false);
    const maxCount = Math.max(...result.distribution.map((d) => d.count), 1);
    const summary = result.distribution
        .filter((entry) => entry.count > 0)
        .map((entry) =>
            t(':value × :count', { value: entry.value, count: entry.count }),
        )
        .join(', ');

    return (
        <div className="flex flex-col gap-2">
            {asTable ? (
                <table
                    data-slot="poker-distribution-table"
                    className="w-full text-left text-sm"
                >
                    <thead className="text-muted-foreground">
                        <tr>
                            <th scope="col" className="py-1 font-medium">
                                {t('Value')}
                            </th>
                            <th scope="col" className="py-1 font-medium">
                                {t('Votes')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.distribution.map((entry) => (
                            <tr key={entry.value}>
                                <th scope="row" className="py-1 font-medium">
                                    {entry.value}
                                </th>
                                <td className="py-1">{entry.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div
                    role="img"
                    aria-label={t('Distribution: :summary', { summary })}
                    data-slot="poker-distribution"
                    className="flex items-end gap-2 pb-6"
                >
                    {result.distribution.map((entry) => {
                        const isMode = entry.value === result.mode;
                        const height = Math.max(
                            (entry.count / maxCount) * DistributionMaxRem,
                            DistributionMinRem,
                        );

                        return (
                            <div
                                key={entry.value}
                                data-slot="poker-dist-bar"
                                data-mode={isMode || undefined}
                                data-count={entry.count}
                                className={cn(
                                    'relative w-9 rounded-t-md',
                                    isMode
                                        ? 'bg-primary'
                                        : 'bg-skrum-primary-soft',
                                    entry.count === 0 && 'opacity-50',
                                )}
                                style={{ height: `${height}rem` }}
                            >
                                <span className="absolute inset-x-0 top-full pt-1 text-center text-overline font-semibold text-muted-foreground">
                                    {entry.value}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            <Button
                type="button"
                variant="link"
                size="sm"
                className="self-start px-0"
                aria-pressed={asTable}
                onClick={() => setAsTable((current) => !current)}
            >
                {asTable ? t('View as chart') : t('View as table')}
            </Button>
        </div>
    );
}

function helpSentence(
    t: (key: string, replacements?: Record<string, string | number>) => string,
    result: PokerResult,
    seats: PokerSeat[],
    story: PokerStory,
): string {
    if (result.consensus) {
        return t('Estimate kept for :story.', { story: storyLabel(story) });
    }

    const outliers = result.outliers
        .map((id) => seats.find((seat) => seat.user.id === id))
        .filter((seat): seat is PokerSeat => seat !== undefined);

    if (outliers.length === 2) {
        return t(
            ':first (:firstValue) and :second (:secondValue) explain their estimates, then we revote.',
            {
                first: outliers[0].user.name,
                firstValue: outliers[0].value ?? '–',
                second: outliers[1].user.name,
                secondValue: outliers[1].value ?? '–',
            },
        );
    }

    if (outliers.length === 1) {
        return t(':name (:value) explains their estimate, then we revote.', {
            name: outliers[0].user.name,
            value: outliers[0].value ?? '–',
        });
    }

    return t('The outliers explain their estimates, then we revote.');
}

export function PokerResultPanel({
    result,
    seats,
    story,
    isFacilitator,
    onRevote,
    onAccept,
    onNext,
    className,
}: {
    result: PokerResult;
    seats: PokerSeat[];
    story: PokerStory;
    isFacilitator?: boolean;
    onRevote?: () => void;
    onAccept?: (value: PokerValue) => void;
    onNext?: () => void;
    className?: string;
}) {
    const { t } = useTrans();
    const voteCount = result.distribution.reduce(
        (sum, entry) => sum + entry.count,
        0,
    );
    const numericValues = result.distribution
        .filter((entry) => entry.count > 0)
        .map((entry) => Number(entry.value))
        .filter((value) => Number.isFinite(value));
    const spread =
        numericValues.length > 1
            ? t('Spread :min → :max', {
                  min: Math.min(...numericValues),
                  max: Math.max(...numericValues),
              })
            : null;

    return (
        <section
            aria-label={t('Result')}
            data-slot="poker-result"
            data-consensus={result.consensus}
            className={cn(
                'flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-card',
                className,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-ui-lg font-semibold text-foreground">
                    {t('Result · :count votes', { count: voteCount })}
                </h3>
                <ConsensusBadge consensus={result.consensus}>
                    {result.consensus
                        ? t('Consensus')
                        : (spread ?? t('Needs discussion'))}
                </ConsensusBadge>
            </div>
            <dl className="flex flex-wrap gap-8">
                <Stat label={t('Mean')} value={formatNumber(result.mean)} />
                <Stat label={t('Median')} value={formatNumber(result.median)} />
                <Stat
                    label={t('Agreement (mode :mode)', { mode: result.mode })}
                    value={`${Math.round(result.agreement * 100)}%`}
                />
            </dl>
            <Distribution result={result} />
            <p className="text-sm text-muted-foreground">
                {helpSentence(t, result, seats, story)}
            </p>
            {isFacilitator && (
                <div className="flex flex-wrap items-center gap-2">
                    {result.consensus ? (
                        <>
                            <span
                                aria-hidden
                                className="flex h-10 w-7 items-center justify-center rounded-md border border-primary bg-card font-display text-base font-bold text-secondary-foreground shadow-card ring-2 ring-primary"
                            >
                                {result.mode}
                            </span>
                            {onAccept && (
                                <ShortcutTooltip
                                    shortcut="⌘/Ctrl+↵"
                                    label={t('Accept')}
                                >
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => onAccept(result.mode)}
                                    >
                                        <Check aria-hidden />
                                        {t('Accept :value points', {
                                            value: result.mode,
                                        })}
                                    </Button>
                                </ShortcutTooltip>
                            )}
                            {onNext && (
                                <ShortcutTooltip
                                    shortcut="N"
                                    label={t('Next story')}
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={onNext}
                                    >
                                        {t('Next story')}
                                        <ArrowRight aria-hidden />
                                    </Button>
                                </ShortcutTooltip>
                            )}
                        </>
                    ) : (
                        <>
                            {onRevote && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={onRevote}
                                >
                                    <RotateCcw aria-hidden />
                                    {t('Revote')}
                                </Button>
                            )}
                            {onAccept && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onAccept(result.mode)}
                                >
                                    {t('Keep :value', { value: result.mode })}
                                </Button>
                            )}
                            {onNext && (
                                <ShortcutTooltip
                                    shortcut="N"
                                    label={t('Next story')}
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={onNext}
                                    >
                                        {t('Next story')}
                                        <ArrowRight aria-hidden />
                                    </Button>
                                </ShortcutTooltip>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dd className="order-1 font-display text-display-lg font-bold text-foreground">
                {value}
            </dd>
            <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
        </div>
    );
}

export function PokerTable({
    story,
    seats,
    revealed,
    result,
    isFacilitator = false,
    onReveal,
    onRevote,
    onAccept,
    onNext,
    className,
}: PokerTableProps) {
    const { t } = useTrans();
    const outlierIds = new Set(revealed ? (result?.outliers ?? []) : []);
    const isOval = seats.length <= MaxOvalSeats;
    const canAccept =
        isFacilitator && revealed && result !== undefined && !!onAccept;

    useShortcut('r', () => onReveal?.(), {
        enabled: isFacilitator && !revealed && !!onReveal,
    });
    useShortcut('n', () => onNext?.(), {
        enabled: isFacilitator && revealed && !!onNext,
    });
    useShortcut(
        'mod+enter',
        () => {
            if (result) {
                onAccept?.(result.mode);
            }
        },
        { enabled: canAccept },
    );

    const renderSeat = (index: number, reverse?: boolean) => (
        <SeatView
            key={seats[index].user.id}
            seat={seats[index]}
            index={index}
            revealed={revealed}
            outlier={outlierIds.has(seats[index].user.id)}
            reverse={reverse}
        />
    );
    const center = (
        <TableCenter
            story={story}
            seats={seats}
            revealed={revealed}
            result={result}
            isFacilitator={isFacilitator}
            onReveal={onReveal}
        />
    );
    const { top, left, right, bottom } = splitSeats(seats.length);

    return (
        <div
            data-slot="poker-table"
            className={cn('flex min-w-0 flex-col gap-6', className)}
        >
            {isOval ? (
                <div
                    role="group"
                    aria-label={t('Poker table, :story', {
                        story: story.key ?? story.title,
                    })}
                    data-layout="oval"
                    className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] grid-rows-[auto_8.25rem_auto] items-center gap-3"
                >
                    <div className="col-span-3 row-start-1 flex justify-around gap-2">
                        {top.map((index) => renderSeat(index, true))}
                    </div>
                    <div className="col-start-1 row-start-2 flex flex-col items-center gap-3">
                        {left.map((index) => renderSeat(index))}
                    </div>
                    <div
                        data-slot="poker-oval"
                        className="col-start-2 row-start-2 flex h-full min-w-0 items-center justify-center rounded-full bg-secondary px-6 shadow-card"
                    >
                        {center}
                    </div>
                    <div className="col-start-3 row-start-2 flex flex-col items-center gap-3">
                        {right.map((index) => renderSeat(index))}
                    </div>
                    <div className="col-span-3 row-start-3 flex justify-around gap-2">
                        {bottom.map((index) => renderSeat(index))}
                    </div>
                </div>
            ) : (
                <div
                    role="group"
                    aria-label={t('Poker table, :story', {
                        story: story.key ?? story.title,
                    })}
                    data-layout="grid"
                    className="flex flex-col gap-4"
                >
                    <div
                        data-slot="poker-bar"
                        className="rounded-xl bg-secondary px-6 py-4 shadow-card"
                    >
                        {center}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] justify-items-center gap-3">
                        {seats.map((_, index) => renderSeat(index))}
                    </div>
                </div>
            )}
            {revealed && result && (
                <PokerResultPanel
                    result={result}
                    seats={seats}
                    story={story}
                    isFacilitator={isFacilitator}
                    onRevote={onRevote}
                    onAccept={onAccept}
                    onNext={onNext}
                />
            )}
        </div>
    );
}
