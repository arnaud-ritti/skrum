import {
    ArrowRight,
    Check,
    CircleCheck,
    Crown,
    Eye,
    RotateCcw,
    Split,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { PokerCard } from '@/components/skrum/poker-card';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard } from '@/lib/poker/types';
import type {
    PokerRevealReason,
    PokerResult as ServerPokerResult,
} from '@/lib/poker/types';
import { cn } from '@/lib/utils';

export type PokerValue = string;

export interface PokerSeatUser {
    id: string;
    name: string;
    avatarUrl?: string | null;
    presence?: number;
    isMe?: boolean;
}

export interface PokerSeat {
    user: PokerSeatUser;
    state: 'waiting' | 'voted' | 'absent' | 'watching';
    value?: PokerValue | null;
    offline?: boolean;
}

/**
 * The server result as it is (B39). `outliers` is also taken as a flat list of
 * user ids, the shape of the design system. Each statistic is shown only when
 * it is given.
 */
export type PokerResult = Omit<ServerPokerResult, 'outliers'> & {
    outliers?: string[] | { low: string[]; high: string[] };
};

function outlierIdsOf(result: PokerResult | null | undefined): string[] {
    const outliers = result?.outliers;

    if (!outliers) {
        return [];
    }

    return Array.isArray(outliers)
        ? outliers
        : [...outliers.low, ...outliers.high];
}

export interface PokerStory {
    key?: string;
    title: string;
    url?: string;
}

type FacilitatorActionProps = {
    isFacilitator?: boolean;
    busy?: boolean;
    estimate?: PokerValue | null;
    estimateValues?: PokerValue[];
    isNumeric?: boolean;
    nextDisabled?: boolean;
    shortcuts?: boolean;
    onRevote?: () => void;
    onAccept?: (value: PokerValue) => void;
    onNext?: () => void;
};

export interface PokerTableProps extends FacilitatorActionProps {
    story: PokerStory;
    seats: PokerSeat[];
    revealed: boolean;
    result?: PokerResult | null;
    anonymous?: boolean;
    revealReason?: PokerRevealReason | null;
    facilitatorId?: string | null;
    locale?: string;
    seatMenu?: (seat: PokerSeat) => ReactNode;
    votingTools?: ReactNode;
    /** Accessible name of the seats region; "Players" by default. */
    tableLabel?: string;
    onReveal?: () => void;
    className?: string;
}

export interface PokerResultPanelProps extends FacilitatorActionProps {
    result: PokerResult;
    seats?: PokerSeat[];
    story: PokerStory;
    anonymous?: boolean;
    revealReason?: PokerRevealReason | null;
    locale?: string;
    /** The section takes focus (tabindex -1) when the votes are revealed. */
    sectionRef?: Ref<HTMLElement>;
    className?: string;
}

const MaxOvalSeats = 12;
const CascadeStepMs = 40;
const CascadeMaxMs = 400;
const DistributionMaxRem = 4.5;
const DistributionMinRem = 0.25;

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

function formatNumber(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        value,
    );
}

function storyLabel(story: PokerStory): string {
    return story.key ? `${story.key} · ${story.title}` : story.title;
}

function toPresence(value: number | undefined): AvatarPresence | undefined {
    if (value === undefined || !Number.isInteger(value)) {
        return undefined;
    }

    return value >= 1 && value <= 12 ? (value as AvatarPresence) : undefined;
}

function hasCountableVotes(result: PokerResult): boolean {
    return result.average !== null || result.mode.length > 0;
}

function showsAverage(result: PokerResult, isNumeric?: boolean): boolean {
    return isNumeric !== false && result.average !== null;
}

/** Nearest card for numeric decks, the single mode otherwise. */
export function suggestedEstimate(
    result: PokerResult | null | undefined,
    isNumeric?: boolean,
): PokerValue | null {
    if (!result) {
        return null;
    }

    if (isNumeric !== false && result.nearestCard !== null) {
        return result.nearestCard;
    }

    if (isNumeric === true) {
        return null;
    }

    return result.mode.length === 1 ? result.mode[0] : null;
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

/**
 * The name the game page has always given a seat card: "Bob: Voted",
 * "Bob: Not voted yet", "Bob: 5". The real name, also on the viewer's seat.
 */
function seatLabel(
    t: Translate,
    seat: PokerSeat,
    shownValue: PokerValue | null,
): string {
    if (shownValue !== null) {
        return `${seat.user.name}: ${shownValue}`;
    }

    if (seat.state === 'voted') {
        return `${seat.user.name}: ${t('Voted')}`;
    }

    if (seat.state === 'absent') {
        return `${seat.user.name}: ${t('Absent')}`;
    }

    return `${seat.user.name}: ${t('Not voted yet')}`;
}

function SeatView({
    seat,
    index,
    revealed,
    anonymous,
    outlier,
    isFacilitator,
    menu,
    reverse,
}: {
    seat: PokerSeat;
    index: number;
    revealed: boolean;
    anonymous: boolean;
    outlier: boolean;
    isFacilitator: boolean;
    menu?: ReactNode;
    reverse?: boolean;
}) {
    const { t } = useTrans();
    const name = seat.user.isMe ? t('You') : seat.user.name;
    const hasCard = seat.state === 'voted';
    const shownValue =
        revealed && !anonymous && hasCard && seat.value != null
            ? seat.value
            : null;
    const hasMenu = menu !== null && menu !== undefined && menu !== false;

    return (
        <div
            data-slot="poker-seat"
            data-state={seat.state}
            className={cn(
                'flex w-18 min-w-0 shrink flex-col items-center gap-1.5',
                reverse && '@md/poker:flex-col-reverse',
                (seat.state === 'absent' || seat.offline) && 'opacity-60',
            )}
        >
            <span
                data-slot="poker-seat-card"
                data-face={
                    !hasCard ? 'empty' : shownValue !== null ? 'up' : 'down'
                }
                data-outlier={outlier || undefined}
                className="flex"
            >
                <PokerCard
                    value={shownValue ?? ''}
                    size="sm"
                    empty={!hasCard}
                    faceDown={hasCard && shownValue === null}
                    delay={Math.min(index * CascadeStepMs, CascadeMaxMs)}
                    label={seatLabel(t, seat, shownValue)}
                    className={cn(outlier && 'ring-2 ring-skrum-warning')}
                />
                {outlier && (
                    <span className="sr-only">{t('Worth discussing')}</span>
                )}
            </span>
            <span className="inline-flex max-w-full min-w-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-foreground">
                <PersonAvatar
                    name={seat.user.name}
                    src={seat.user.avatarUrl}
                    size="xs"
                    decorative
                    presence={toPresence(seat.user.presence)}
                />
                <span className="truncate">{name}</span>
                {isFacilitator && (
                    <Crown
                        role="img"
                        aria-label={t('Facilitator')}
                        data-slot="poker-seat-facilitator"
                        className="size-3 shrink-0 text-skrum-warning-text"
                    />
                )}
            </span>
            {hasMenu && (
                <span data-slot="poker-seat-menu" className="flex max-w-full">
                    {menu}
                </span>
            )}
            {seat.offline && (
                <span className="max-w-full truncate text-overline text-muted-foreground">
                    {t('Offline')}
                </span>
            )}
            {!revealed && !seat.offline && (
                <span
                    aria-hidden
                    className={cn(
                        'inline-flex max-w-full items-center gap-1 text-overline whitespace-nowrap',
                        seat.state === 'voted'
                            ? 'text-skrum-success-text'
                            : 'text-muted-foreground',
                    )}
                >
                    {seat.state === 'voted' && (
                        <>
                            <Check className="size-3 shrink-0" />
                            <span className="truncate">{t('voted')}</span>
                        </>
                    )}
                    {seat.state === 'waiting' && (
                        <>
                            <Trema />
                            <span className="truncate">{t('thinking')}</span>
                        </>
                    )}
                    {seat.state === 'absent' && (
                        <span className="truncate">{t('absent')}</span>
                    )}
                </span>
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
            className="max-w-full"
        >
            <span className="truncate">
                {children ??
                    (consensus ? t('Consensus') : t('Needs discussion'))}
            </span>
        </Badge>
    );
}

function TableCenter({
    story,
    voters,
    revealed,
    result,
    isNumeric,
    locale,
    isFacilitator,
    busy,
    onReveal,
}: {
    story: PokerStory;
    voters: PokerSeat[];
    revealed: boolean;
    result?: PokerResult | null;
    isNumeric?: boolean;
    locale?: string;
    isFacilitator: boolean;
    busy: boolean;
    onReveal?: () => void;
}) {
    const { t } = useTrans();
    const present = voters.filter((seat) => seat.state !== 'absent');
    const votedCount = voters.filter((seat) => seat.state === 'voted').length;
    const title = storyLabel(story);
    const canReveal = !busy && votedCount > 0;

    return (
        <div
            data-slot="poker-table-center"
            className="flex w-full min-w-0 flex-col items-center gap-2 text-center"
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
            {revealed && result && !hasCountableVotes(result) && (
                <span className="max-w-full text-xs text-secondary-foreground">
                    {t('No countable votes')}
                </span>
            )}
            {revealed && result && hasCountableVotes(result) && (
                <>
                    <span className="max-w-full truncate text-xs text-secondary-foreground">
                        {showsAverage(result, isNumeric)
                            ? t('Average')
                            : t('Most played')}
                    </span>
                    <span
                        data-slot="poker-headline"
                        className="max-w-full truncate font-display text-display-lg font-bold text-secondary-foreground"
                    >
                        {showsAverage(result, isNumeric) &&
                        result.average !== null
                            ? formatNumber(result.average, locale)
                            : result.mode.join(', ')}
                    </span>
                    <ConsensusBadge consensus={result.consensus} />
                </>
            )}
            {!revealed && (
                <>
                    <div className="w-36 max-w-full">
                        <Progress
                            value={votedCount}
                            max={Math.max(present.length, 1)}
                            tone="primary"
                            aria-label={t('Voting progress')}
                        />
                    </div>
                    <span
                        data-slot="poker-progress"
                        className="max-w-full text-xs text-secondary-foreground"
                    >
                        {t(':voted of :total voted', {
                            voted: votedCount,
                            total: present.length,
                        })}
                    </span>
                    {isFacilitator && onReveal && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="sm"
                                    className={cn(
                                        'max-w-full min-w-0',
                                        !canReveal &&
                                            'cursor-not-allowed opacity-50',
                                    )}
                                    aria-disabled={!canReveal || undefined}
                                    onClick={() => {
                                        if (canReveal) {
                                            onReveal();
                                        }
                                    }}
                                >
                                    <Eye aria-hidden />
                                    <span className="truncate">
                                        {t('Show votes')}
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent shortcut={['R']}>
                                {t('Show votes')}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </>
            )}
        </div>
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
        <div className="flex min-w-0 flex-col gap-2">
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
                    tabIndex={0}
                    aria-label={t('Distribution: :summary', { summary })}
                    data-slot="poker-distribution"
                    className="flex max-w-full items-end gap-2 overflow-x-auto rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {result.distribution.map((entry) => {
                        const isMode = result.mode.includes(entry.value);
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
                                className="flex min-w-9 shrink-0 flex-col items-center gap-1"
                            >
                                <span
                                    className={cn(
                                        'w-full rounded-t-md',
                                        isMode
                                            ? 'bg-primary'
                                            : 'bg-skrum-primary-soft',
                                        entry.count === 0 && 'opacity-50',
                                    )}
                                    style={{ height: `${height}rem` }}
                                />
                                <span className="text-overline font-semibold whitespace-nowrap text-muted-foreground">
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
                className="max-w-full min-w-0 self-start px-0"
                aria-pressed={asTable}
                onClick={() => setAsTable((current) => !current)}
            >
                <span className="truncate">
                    {asTable ? t('View as chart') : t('View as table')}
                </span>
            </Button>
        </div>
    );
}

function helpSentence(
    t: Translate,
    result: PokerResult,
    seats: PokerSeat[],
    story: PokerStory,
    anonymous: boolean,
): string {
    if (result.consensus) {
        return t('Estimate kept for :story.', { story: storyLabel(story) });
    }

    const outliers = anonymous
        ? []
        : outlierIdsOf(result)
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

function estimateOptions(
    result: PokerResult | null | undefined,
    estimateValues: PokerValue[] | undefined,
    extras: (PokerValue | null | undefined)[],
): PokerValue[] {
    const base =
        estimateValues ??
        (result?.distribution ?? [])
            .map((entry) => entry.value)
            .filter((value) => !isSpecialCard(value));
    const options = [...base];

    for (const extra of extras) {
        if (extra && !options.includes(extra)) {
            options.push(extra);
        }
    }

    return options;
}

function ResultActions({
    result,
    busy = false,
    estimate,
    estimateValues,
    isNumeric,
    nextDisabled = false,
    shortcuts = true,
    onRevote,
    onAccept,
    onNext,
}: Omit<FacilitatorActionProps, 'isFacilitator'> & {
    result?: PokerResult | null;
}) {
    const { t } = useTrans();
    const [choice, setChoice] = useState<PokerValue | null>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const suggestion = suggestedEstimate(result, isNumeric);
    const value = choice ?? estimate ?? suggestion ?? '';
    const options = estimateOptions(result, estimateValues, [
        estimate,
        suggestion,
    ]);
    const consensus = result?.consensus === true;
    const canAccept = !!onAccept && value !== '' && !busy;
    const canNext = !!onNext && !nextDisabled && !busy;

    useShortcut('mod+enter', () => onAccept?.(value), {
        scope: actionsRef,
        enabled: shortcuts && canAccept,
    });
    useShortcut('n', () => onNext?.(), {
        scope: actionsRef,
        enabled: shortcuts && canNext,
    });

    if (!onRevote && !onAccept && !onNext) {
        return null;
    }

    return (
        <div
            ref={actionsRef}
            role="group"
            aria-label={t('Facilitator tools')}
            data-slot="poker-actions"
            className="flex min-w-0 flex-wrap items-center gap-2"
        >
            {onRevote && (
                <Button
                    type="button"
                    size="sm"
                    variant={consensus ? 'outline' : 'default'}
                    className={cn('max-w-full min-w-0', busy && busyAction)}
                    aria-disabled={busy || undefined}
                    onClick={() => {
                        if (!busy) {
                            onRevote();
                        }
                    }}
                >
                    <RotateCcw aria-hidden />
                    <span className="truncate">{t('Re-vote')}</span>
                </Button>
            )}
            {onAccept && (
                <>
                    <Select value={value} onValueChange={setChoice}>
                        <SelectTrigger
                            size="sm"
                            className="w-36 max-w-full"
                            aria-label={t('Estimate')}
                        >
                            <SelectValue placeholder={t('Estimate')} />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((card) => (
                                <SelectItem key={card} value={card}>
                                    {card}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                size="sm"
                                variant={consensus ? 'default' : 'outline'}
                                className={cn(
                                    'max-w-full min-w-0',
                                    busy && busyAction,
                                )}
                                disabled={value === ''}
                                aria-disabled={busy || undefined}
                                onClick={() => {
                                    if (!busy) {
                                        onAccept(value);
                                    }
                                }}
                            >
                                <Check aria-hidden />
                                <span className="truncate">
                                    {t('Save estimate')}
                                </span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent shortcut={['⌘/Ctrl', '↵']}>
                            {t('Save estimate')}
                        </TooltipContent>
                    </Tooltip>
                </>
            )}
            {onNext && (
                <NextTaskButton
                    disabled={nextDisabled}
                    busy={busy}
                    onNext={onNext}
                />
            )}
        </div>
    );
}

/**
 * A busy action keeps its focus: a native `disabled` would drop the focus of
 * the button that was just pressed.
 */
const busyAction = 'cursor-not-allowed opacity-50';

function NextTaskButton({
    disabled,
    busy,
    onNext,
}: {
    disabled: boolean;
    busy: boolean;
    onNext: () => void;
}) {
    const { t } = useTrans();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('max-w-full min-w-0', busy && busyAction)}
                    disabled={disabled}
                    aria-disabled={busy || undefined}
                    onClick={() => {
                        if (!busy) {
                            onNext();
                        }
                    }}
                >
                    <span className="truncate">{t('Next task')}</span>
                    <ArrowRight aria-hidden />
                </Button>
            </TooltipTrigger>
            <TooltipContent shortcut={['N']}>{t('Next task')}</TooltipContent>
        </Tooltip>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex max-w-full min-w-0 flex-col gap-0.5">
            <dd className="order-1 truncate font-display text-display-lg font-bold text-foreground">
                {value}
            </dd>
            <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
        </div>
    );
}

/**
 * Lowest and highest estimate that got a vote. The server sends the
 * distribution in deck order, so no value is parsed as a number here.
 */
function spreadOf(result: PokerResult): [PokerValue, PokerValue] | null {
    const played = result.distribution
        .filter((entry) => entry.count > 0 && !isSpecialCard(entry.value))
        .map((entry) => entry.value);

    return played.length > 1 ? [played[0], played[played.length - 1]] : null;
}

export function PokerResultPanel({
    result,
    seats = [],
    story,
    anonymous = false,
    revealReason,
    locale,
    isFacilitator,
    sectionRef,
    className,
    ...actions
}: PokerResultPanelProps) {
    const { t } = useTrans();
    const voteCount = result.distribution.reduce(
        (sum, entry) => sum + entry.count,
        0,
    );
    const spread = spreadOf(result);
    const countable = hasCountableVotes(result);

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            aria-label={t('Result')}
            data-slot="poker-result"
            data-consensus={result.consensus}
            className={cn(
                'flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 text-ui-lg font-semibold text-foreground">
                    {t('Result · :count votes', { count: voteCount })}
                </h3>
                {countable && (
                    <ConsensusBadge consensus={result.consensus}>
                        {result.consensus
                            ? t('Consensus')
                            : spread
                              ? t('Spread :min → :max', {
                                    min: spread[0],
                                    max: spread[1],
                                })
                              : t('Needs discussion')}
                    </ConsensusBadge>
                )}
            </div>
            {revealReason === 'everyone_voted' && (
                <p className="text-sm text-muted-foreground">
                    {t('Revealed automatically — everyone voted')}
                </p>
            )}
            {revealReason === 'timer' && (
                <p className="text-sm text-muted-foreground">
                    {t("Revealed automatically — time's up")}
                </p>
            )}
            {countable ? (
                <dl className="flex min-w-0 flex-wrap gap-x-8 gap-y-4">
                    {showsAverage(result, actions.isNumeric) &&
                        result.average !== null && (
                            <Stat
                                label={t('Average')}
                                value={formatNumber(result.average, locale)}
                            />
                        )}
                    {showsAverage(result, actions.isNumeric) &&
                        result.nearestCard !== null && (
                            <Stat
                                label={t('Nearest card')}
                                value={result.nearestCard}
                            />
                        )}
                    {result.median !== undefined && result.median !== null && (
                        <Stat
                            label={t('Median')}
                            value={formatNumber(result.median, locale)}
                        />
                    )}
                    {result.mode.length > 0 && (
                        <Stat
                            label={t('Most played')}
                            value={result.mode.join(', ')}
                        />
                    )}
                    {result.agreement !== undefined &&
                        result.agreement !== null && (
                            <Stat
                                label={t('Agreement')}
                                value={`${Math.round(result.agreement * 100)}%`}
                            />
                        )}
                </dl>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('No countable votes')}
                </p>
            )}
            <Distribution result={result} />
            {countable && (
                <p className="text-sm text-muted-foreground">
                    {helpSentence(t, result, seats, story, anonymous)}
                </p>
            )}
            {isFacilitator && <ResultActions result={result} {...actions} />}
        </section>
    );
}

function AnonymousValues({ result }: { result: PokerResult }) {
    const { t } = useTrans();
    const values = result.distribution.flatMap(({ value, count }) =>
        Array.from({ length: count }, () => value),
    );

    return (
        <section
            aria-label={t('Anonymous votes')}
            data-slot="poker-anonymous-votes"
            className="flex min-w-0 flex-col gap-2"
        >
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Anonymous votes')}
            </h3>
            <ul className="flex flex-wrap gap-2">
                {values.map((value, index) => (
                    <li key={`${value}-${index}`} className="flex">
                        <PokerCard value={value} size="sm" />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function WatchingRow({
    watchers,
    seatMenu,
}: {
    watchers: PokerSeat[];
    seatMenu?: (seat: PokerSeat) => ReactNode;
}) {
    const { t } = useTrans();

    return (
        <section
            aria-label={t('Watching')}
            data-slot="poker-watching"
            className="flex min-w-0 flex-col gap-2"
        >
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Watching')}
            </h3>
            <ul className="flex min-w-0 flex-wrap gap-3">
                {watchers.map((seat) => (
                    <li
                        key={seat.user.id}
                        className={cn(
                            'flex max-w-full min-w-0 items-center gap-2',
                            seat.offline && 'opacity-60',
                        )}
                    >
                        <PersonAvatar
                            name={seat.user.name}
                            src={seat.user.avatarUrl}
                            size="xs"
                            decorative
                            presence={toPresence(seat.user.presence)}
                        />
                        <span className="truncate text-sm">
                            {seat.user.isMe ? t('You') : seat.user.name}
                        </span>
                        {seatMenu?.(seat)}
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function PokerTable({
    story,
    seats,
    revealed,
    result,
    anonymous = false,
    revealReason,
    facilitatorId,
    locale,
    seatMenu,
    votingTools,
    isFacilitator = false,
    busy = false,
    estimate,
    estimateValues,
    isNumeric,
    nextDisabled = false,
    shortcuts = true,
    tableLabel,
    onReveal,
    onRevote,
    onAccept,
    onNext,
    className,
}: PokerTableProps) {
    const { t } = useTrans();
    const rootRef = useRef<HTMLDivElement>(null);
    const seatsRef = useRef<HTMLElement>(null);
    const resultRef = useRef<HTMLElement>(null);
    const hadFocusInside = useRef(false);
    const wasRevealed = useRef(revealed);
    const players = seats.filter((seat) => seat.state !== 'watching');
    const watchers = seats.filter((seat) => seat.state === 'watching');
    const outlierIds = new Set(
        revealed && !anonymous ? outlierIdsOf(result) : [],
    );
    const isOval = players.length <= MaxOvalSeats;
    const hasVotes = players.some((seat) => seat.state === 'voted');
    const seatsLabel = tableLabel ?? t('Players');
    const votedCount = players.filter((seat) => seat.state === 'voted').length;
    const presentCount = players.filter(
        (seat) => seat.state !== 'absent',
    ).length;
    const actions = {
        busy,
        estimate,
        estimateValues,
        isNumeric,
        nextDisabled,
        shortcuts,
        onRevote,
        onAccept,
        onNext,
    };

    useShortcut('r', () => onReveal?.(), {
        scope: rootRef,
        enabled:
            shortcuts &&
            isFacilitator &&
            !revealed &&
            !!onReveal &&
            hasVotes &&
            !busy,
    });

    // The control that revealed (or reset) the round unmounts with the state
    // it belonged to: focus follows to the result, or back to the seats.
    useEffect(() => {
        const before = wasRevealed.current;

        wasRevealed.current = revealed;

        if (before === revealed || !hadFocusInside.current) {
            return;
        }

        const active = document.activeElement;

        if (active !== null && active !== document.body) {
            return;
        }

        const target = revealed
            ? (resultRef.current ?? seatsRef.current)
            : seatsRef.current;

        target?.focus();
    }, [revealed]);

    const announcement = (): string => {
        if (!revealed) {
            return t(':voted of :total voted', {
                voted: votedCount,
                total: presentCount,
            });
        }

        if (!result) {
            return t('Votes revealed');
        }

        if (!hasCountableVotes(result)) {
            return `${t('Votes revealed')}. ${t('No countable votes')}`;
        }

        const headline =
            showsAverage(result, isNumeric) && result.average !== null
                ? `${t('Average')}: ${formatNumber(result.average, locale)}`
                : t('Most played: :cards', { cards: result.mode.join(', ') });
        const verdict = result.consensus
            ? t('Consensus')
            : t('Needs discussion');

        return `${t('Votes revealed')}. ${headline}. ${verdict}`;
    };

    const renderSeat = (index: number, reverse?: boolean) => (
        <SeatView
            key={players[index].user.id}
            seat={players[index]}
            index={index}
            revealed={revealed}
            anonymous={anonymous}
            outlier={outlierIds.has(players[index].user.id)}
            isFacilitator={
                facilitatorId != null &&
                players[index].user.id === facilitatorId
            }
            menu={seatMenu?.(players[index])}
            reverse={reverse}
        />
    );
    const center = (
        <TableCenter
            story={story}
            voters={players}
            revealed={revealed}
            result={result}
            isNumeric={isNumeric}
            locale={locale}
            isFacilitator={isFacilitator}
            busy={busy}
            onReveal={onReveal}
        />
    );
    const { top, left, right, bottom } = splitSeats(players.length);
    const seatGrid =
        'grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] justify-items-center gap-3';
    const seatsFocus =
        'rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring';
    const seatBar =
        'col-span-full flex w-full min-w-0 items-center justify-center rounded-xl bg-secondary px-6 py-4 shadow-card';

    return (
        <div
            ref={rootRef}
            data-slot="poker-table"
            onFocus={() => {
                hadFocusInside.current = true;
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    hadFocusInside.current = false;
                }
            }}
            className={cn(
                '@container/poker flex min-w-0 flex-col gap-6',
                className,
            )}
        >
            <p
                role="status"
                aria-live="polite"
                data-slot="poker-status"
                className="sr-only"
            >
                {announcement()}
            </p>
            {isOval ? (
                <section
                    ref={seatsRef}
                    tabIndex={-1}
                    aria-label={seatsLabel}
                    data-layout="oval"
                    className={cn(
                        seatGrid,
                        seatsFocus,
                        '@md/poker:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] @md/poker:grid-rows-[auto_minmax(8.25rem,auto)_auto] @md/poker:items-center',
                    )}
                >
                    <div className="contents justify-around gap-2 @md/poker:col-span-3 @md/poker:row-start-1 @md/poker:flex @md/poker:w-full">
                        {top.map((index) => renderSeat(index, true))}
                    </div>
                    <div className="contents flex-col items-center gap-3 @md/poker:col-start-1 @md/poker:row-start-2 @md/poker:flex">
                        {left.map((index) => renderSeat(index))}
                    </div>
                    <div
                        data-slot="poker-oval"
                        className={cn(
                            seatBar,
                            '-order-1 @md/poker:order-none @md/poker:col-span-1 @md/poker:col-start-2 @md/poker:row-start-2 @md/poker:h-full @md/poker:rounded-full',
                        )}
                    >
                        {center}
                    </div>
                    <div className="contents flex-col items-center gap-3 @md/poker:col-start-3 @md/poker:row-start-2 @md/poker:flex">
                        {right.map((index) => renderSeat(index))}
                    </div>
                    <div className="contents justify-around gap-2 @md/poker:col-span-3 @md/poker:row-start-3 @md/poker:flex @md/poker:w-full">
                        {bottom.map((index) => renderSeat(index))}
                    </div>
                </section>
            ) : (
                <section
                    ref={seatsRef}
                    tabIndex={-1}
                    aria-label={seatsLabel}
                    data-layout="grid"
                    className={cn(seatGrid, seatsFocus)}
                >
                    <div data-slot="poker-bar" className={seatBar}>
                        {center}
                    </div>
                    {players.map((_, index) => renderSeat(index))}
                </section>
            )}
            {!revealed && isFacilitator && (votingTools || onNext) && (
                <div
                    role="group"
                    aria-label={t('Facilitator tools')}
                    data-slot="poker-actions"
                    className="flex min-w-0 flex-wrap items-center justify-center gap-2"
                >
                    {votingTools}
                    {onNext && (
                        <NextTaskButton
                            disabled={nextDisabled}
                            busy={busy}
                            onNext={onNext}
                        />
                    )}
                </div>
            )}
            {revealed && anonymous && result && (
                <AnonymousValues result={result} />
            )}
            {watchers.length > 0 && (
                <WatchingRow watchers={watchers} seatMenu={seatMenu} />
            )}
            {revealed && result && (
                <PokerResultPanel
                    key={story.key ?? story.title}
                    sectionRef={resultRef}
                    result={result}
                    seats={players}
                    story={story}
                    anonymous={anonymous}
                    revealReason={revealReason}
                    locale={locale}
                    isFacilitator={isFacilitator}
                    {...actions}
                />
            )}
            {revealed && !result && isFacilitator && (
                <ResultActions key={story.key ?? story.title} {...actions} />
            )}
        </div>
    );
}
