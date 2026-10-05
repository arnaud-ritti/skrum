import {
    ArrowRight,
    Check,
    CircleCheck,
    Clock,
    Crown,
    Eye,
    RotateCcw,
    Split,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { PokerCard } from '@/components/skrum/poker-card';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Trema } from '@/components/skrum/trema';
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
    /** false when the story is shown beside the table. The centre names the story until the reveal only. */
    showStory?: boolean;
    /** Id of the result heading, which names the result section. */
    resultId?: string;
    /**
     * false when the result is shown elsewhere (the dock of the room, see
     * `PokerResultBar`): once revealed the oval says "Cards revealed" with
     * the median and the votes, no panel follows the seats, and focus is left
     * to whoever shows the result.
     */
    showResult?: boolean;
    /**
     * `row` on a phone, as the mockup: "Players" with the progress, then the
     * players in one row that scrolls sideways, the avatar pinned on the card,
     * and the facilitator's reveal. The result is shown elsewhere. `table`
     * (default) seats them around the oval.
     */
    seatsLayout?: 'table' | 'row';
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
    /** Id of the heading that names the section; generated when absent. */
    headingId?: string;
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

export function formatNumber(value: number, locale?: string): string {
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

export function hasCountableVotes(
    result: Pick<PokerResult, 'average' | 'mode'>,
): boolean {
    return result.average !== null || result.mode.length > 0;
}

export function showsAverage(
    result: PokerResult,
    isNumeric?: boolean,
): boolean {
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

/** The first word of a display name: what a seat has room for. */
export function firstNameOf(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The name under a seat. A seat shows the first name; the full name is the
 * tooltip and what a screen reader says.
 */
function SeatName({
    seat,
    className,
}: {
    seat: PokerSeat;
    className?: string;
}) {
    const { t } = useTrans();
    const fullName = seat.user.name;
    const firstName = firstNameOf(fullName);

    if (seat.user.isMe) {
        return (
            <span
                data-slot="poker-seat-name"
                title={fullName}
                className={className}
            >
                {t('You')}
            </span>
        );
    }

    if (firstName === fullName) {
        return (
            <span data-slot="poker-seat-name" className={className}>
                {fullName}
            </span>
        );
    }

    return (
        <span
            data-slot="poker-seat-name"
            title={fullName}
            className={className}
        >
            <span aria-hidden>{firstName}</span>
            <span className="sr-only">{fullName}</span>
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
    const name = seat.user.name;

    if (shownValue !== null) {
        return t(':name: :state', { name, state: shownValue });
    }

    if (seat.state === 'voted') {
        return t(':name: :state', { name, state: t('Voted') });
    }

    if (seat.state === 'absent') {
        return t(':name: :state', { name, state: t('Absent') });
    }

    return t(':name: :state', { name, state: t('Not voted yet') });
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
    compact = false,
}: {
    seat: PokerSeat;
    index: number;
    revealed: boolean;
    anonymous: boolean;
    outlier: boolean;
    isFacilitator: boolean;
    menu?: ReactNode;
    reverse?: boolean;
    /** A seat of the phone row: the avatar on the card, the first name under it. */
    compact?: boolean;
}) {
    const { t } = useTrans();
    const hasCard = seat.state === 'voted';
    const shownValue =
        revealed && !anonymous && hasCard && seat.value != null
            ? seat.value
            : null;
    const hasMenu = menu !== null && menu !== undefined && menu !== false;
    // Before the reveal a seat carries a value only for its own player.
    const ownValue =
        !revealed && seat.user.isMe && seat.value != null ? seat.value : null;

    const card = (
        <>
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
        </>
    );
    const crown = isFacilitator && (
        <Crown
            role="img"
            aria-label={t('Facilitator')}
            data-slot="poker-seat-facilitator"
            className="size-3 shrink-0 text-skrum-warning-text"
        />
    );
    const face = !hasCard ? 'empty' : shownValue !== null ? 'up' : 'down';

    if (compact) {
        return (
            <div
                data-slot="poker-seat"
                data-state={seat.state}
                className={cn(
                    'flex w-13 shrink-0 flex-col items-center gap-1',
                    (seat.state === 'absent' || seat.offline) && 'opacity-60',
                )}
            >
                <span
                    data-slot="poker-seat-card"
                    data-face={face}
                    data-outlier={outlier || undefined}
                    className="relative mb-2 flex"
                >
                    {card}
                    {!revealed && !hasCard && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 grid place-items-center pb-2 text-muted-foreground"
                        >
                            {seat.state === 'absent' || seat.offline ? (
                                <Clock className="size-4" />
                            ) : (
                                <Trema className="gap-0.5" />
                            )}
                        </span>
                    )}
                    <PersonAvatar
                        name={seat.user.name}
                        src={seat.user.avatarUrl}
                        size="xs"
                        decorative
                        presence={toPresence(seat.user.presence)}
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 ring-2 ring-background"
                    />
                </span>
                <span className="inline-flex max-w-full min-w-0 items-center gap-0.5 text-xs font-medium whitespace-nowrap text-foreground">
                    <SeatName seat={seat} className="truncate" />
                    {crown}
                </span>
                {hasMenu && (
                    <span
                        data-slot="poker-seat-menu"
                        className="flex max-w-full"
                    >
                        {menu}
                    </span>
                )}
                {seat.offline && (
                    <span className="max-w-full truncate text-overline text-muted-foreground">
                        {t('Offline')}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            data-slot="poker-seat"
            data-state={seat.state}
            className={cn(
                'flex w-18 min-w-0 shrink flex-col items-center gap-1.5 @md/poker:w-24',
                reverse && '@md/poker:flex-col-reverse',
                (seat.state === 'absent' || seat.offline) && 'opacity-60',
            )}
        >
            <span
                data-slot="poker-seat-card"
                data-face={face}
                data-outlier={outlier || undefined}
                className="flex"
            >
                {card}
            </span>
            <span className="inline-flex max-w-full min-w-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-foreground">
                <PersonAvatar
                    name={seat.user.name}
                    src={seat.user.avatarUrl}
                    size="xs"
                    decorative
                    presence={toPresence(seat.user.presence)}
                />
                <SeatName seat={seat} className="truncate" />
                {crown}
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
                            <span
                                data-slot={
                                    ownValue ? 'poker-own-value' : undefined
                                }
                                className="truncate"
                            >
                                {ownValue ?? t('voted')}
                            </span>
                        </>
                    )}
                    {seat.state === 'waiting' && (
                        <>
                            <Trema className="gap-0.5" />
                            <span className="truncate">{t('thinking')}</span>
                        </>
                    )}
                    {seat.state === 'absent' && (
                        <span className="truncate">{t('absent')}</span>
                    )}
                </span>
            )}
            {revealed && outlier && (
                <span
                    aria-hidden
                    data-slot="poker-seat-outlier"
                    className="max-w-full truncate text-overline whitespace-nowrap text-skrum-warning-text"
                >
                    {t('outlier')}
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
    showStory,
    summary,
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
    showStory: boolean;
    /** The result is shown elsewhere: once revealed, the oval says so with the median and the votes. */
    summary: boolean;
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
    const progress = t(':voted of :total voted', {
        voted: votedCount,
        total: present.length,
    });

    return (
        <div
            data-slot="poker-table-center"
            className="flex w-full min-w-0 flex-col items-center gap-2 text-center"
        >
            {showStory && !revealed && (
                <CenterStory story={story} title={title} />
            )}
            {revealed && summary && (
                <RevealedSummary
                    result={result}
                    votedCount={votedCount}
                    total={present.length}
                    isNumeric={isNumeric}
                    locale={locale}
                />
            )}
            {revealed && !summary && result && !hasCountableVotes(result) && (
                <span className="max-w-full text-xs text-secondary-foreground">
                    {t('No countable votes')}
                </span>
            )}
            {revealed && !summary && result && hasCountableVotes(result) && (
                <>
                    <div className="flex max-w-full min-w-0 flex-wrap items-end justify-center gap-x-8 gap-y-1">
                        <CenterStat
                            headline
                            label={
                                showsAverage(result, isNumeric)
                                    ? t('Average')
                                    : t('Most played')
                            }
                            value={
                                showsAverage(result, isNumeric) &&
                                result.average !== null
                                    ? formatNumber(result.average, locale)
                                    : result.mode.join(', ')
                            }
                        />
                        {result.median !== undefined &&
                            result.median !== null && (
                                <CenterStat
                                    label={t('Median')}
                                    value={formatNumber(result.median, locale)}
                                />
                            )}
                    </div>
                    <ConsensusBadge consensus={result.consensus}>
                        {verdictOf(t, result, locale)}
                    </ConsensusBadge>
                </>
            )}
            {!revealed && (
                <>
                    <span
                        data-slot="poker-progress"
                        className="max-w-full text-sm font-semibold text-secondary-foreground"
                    >
                        {progress}
                    </span>
                    <span
                        role="progressbar"
                        aria-label={t('Voting progress')}
                        aria-valuemin={0}
                        aria-valuemax={present.length}
                        aria-valuenow={votedCount}
                        aria-valuetext={progress}
                        data-slot="poker-progress-bar"
                        className="block h-2 w-44 max-w-full overflow-hidden rounded-full bg-card ring-1 ring-border ring-inset"
                    >
                        <span
                            className="block h-full rounded-full bg-primary transition-[width] duration-220 ease-standard motion-reduce:transition-none"
                            style={{
                                width: `${(votedCount / Math.max(present.length, 1)) * 100}%`,
                            }}
                        />
                    </span>
                    {isFacilitator && onReveal && (
                        <RevealButton
                            canReveal={canReveal}
                            onReveal={onReveal}
                        />
                    )}
                </>
            )}
        </div>
    );
}

function RevealButton({
    canReveal,
    onReveal,
}: {
    canReveal: boolean;
    onReveal: () => void;
}) {
    const { t } = useTrans();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    className={cn(
                        'max-w-full min-w-0',
                        !canReveal && 'cursor-not-allowed opacity-50',
                    )}
                    aria-disabled={!canReveal || undefined}
                    onClick={() => {
                        if (canReveal) {
                            onReveal();
                        }
                    }}
                >
                    <Eye aria-hidden />
                    <span className="truncate">{t('Reveal cards')}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent shortcut={['R']}>
                {t('Reveal cards')}
            </TooltipContent>
        </Tooltip>
    );
}

/** "Cards revealed", then the median (the most played card on a deck without numbers) and the votes. */
function RevealedSummary({
    result,
    votedCount,
    total,
    isNumeric,
    locale,
}: {
    result?: PokerResult | null;
    votedCount: number;
    total: number;
    isNumeric?: boolean;
    locale?: string;
}) {
    const { t } = useTrans();
    const votes = t(':voted/:total votes', { voted: votedCount, total });
    const median =
        isNumeric !== false &&
        result?.median !== undefined &&
        result.median !== null
            ? formatNumber(result.median, locale)
            : null;
    const mostPlayed =
        result && result.mode.length > 0 ? result.mode.join(', ') : null;
    const headline = median ?? mostPlayed;

    return (
        <span
            data-slot="poker-revealed-summary"
            className="flex max-w-full min-w-0 flex-col items-center gap-0.5"
        >
            <span className="max-w-full truncate text-overline font-semibold tracking-widest text-secondary-foreground/80 uppercase">
                {t('Cards revealed')}
            </span>
            <span className="flex max-w-full min-w-0 items-baseline gap-2">
                {headline !== null && (
                    <span
                        data-slot="poker-headline"
                        className="shrink-0 font-display text-display-lg font-bold text-secondary-foreground"
                    >
                        {headline}
                    </span>
                )}
                <span className="min-w-0 truncate text-sm text-secondary-foreground">
                    {headline === null
                        ? votes
                        : `${median !== null ? t('median') : t('most played')} · ${votes}`}
                </span>
            </span>
        </span>
    );
}

function CenterStat({
    label,
    value,
    headline = false,
}: {
    label: string;
    value: string;
    headline?: boolean;
}) {
    return (
        <span className="flex max-w-full min-w-0 flex-col items-center">
            <span className="max-w-full truncate text-xs text-secondary-foreground">
                {label}
            </span>
            <span
                data-slot={headline ? 'poker-headline' : 'poker-center-stat'}
                className="max-w-full truncate font-display text-display-lg font-bold text-secondary-foreground"
            >
                {value}
            </span>
        </span>
    );
}

function CenterStory({ story, title }: { story: PokerStory; title: string }) {
    if (story.url) {
        return (
            <a
                href={story.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-full truncate rounded-sm text-body-sm font-semibold text-secondary-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
                {title}
            </a>
        );
    }

    return (
        <span className="max-w-full truncate text-body-sm font-semibold text-secondary-foreground">
            {title}
        </span>
    );
}

export function PokerDistribution({
    result,
    maxRem = DistributionMaxRem,
}: {
    result: PokerResult;
    /** Height of the tallest bar. */
    maxRem?: number;
}) {
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
                <ul
                    role="img"
                    tabIndex={0}
                    aria-label={t('Distribution: :summary', { summary })}
                    data-slot="poker-distribution"
                    className="flex max-w-full items-end gap-2 overflow-x-auto rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {result.distribution.map((entry) => {
                        const isMode = result.mode.includes(entry.value);
                        const height = Math.max(
                            (entry.count / maxCount) * maxRem,
                            DistributionMinRem,
                        );

                        return (
                            <li
                                key={entry.value}
                                data-slot="poker-dist-bar"
                                data-mode={isMode || undefined}
                                data-count={entry.count}
                                className="flex min-w-9 shrink-0 flex-col items-center gap-1"
                            >
                                <span className="order-3 text-overline font-semibold whitespace-nowrap text-muted-foreground">
                                    {entry.value}
                                </span>
                                <span
                                    className={cn(
                                        'order-2 w-full rounded-t-md',
                                        isMode
                                            ? 'bg-primary'
                                            : 'bg-skrum-primary-soft',
                                        entry.count === 0 && 'opacity-50',
                                    )}
                                    style={{ height: `${height}rem` }}
                                />
                                <span className="order-1 text-overline whitespace-nowrap text-muted-foreground tabular-nums">
                                    {entry.count}
                                </span>
                            </li>
                        );
                    })}
                </ul>
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

function listOf(names: string[], locale?: string): string {
    try {
        return new Intl.ListFormat(locale, {
            style: 'long',
            type: 'conjunction',
        }).format(names);
    } catch {
        return names.join(', ');
    }
}

/**
 * What the team does next. The extremes are named from the outliers the
 * server sends, never on an anonymous round.
 */
export function discussionSentence(
    t: Translate,
    result: PokerResult,
    seats: PokerSeat[],
    story: PokerStory,
    anonymous: boolean,
    locale?: string,
): string | null {
    if (result.consensus) {
        return t('Estimate kept for :story.', { story: storyLabel(story) });
    }

    const outliers = anonymous
        ? []
        : outlierIdsOf(result)
              .map((id) => seats.find((seat) => seat.user.id === id))
              .filter((seat): seat is PokerSeat => seat !== undefined);
    const named = outliers.map((seat) =>
        seat.value != null
            ? `${seat.user.name} (${seat.value})`
            : seat.user.name,
    );

    if (named.length === 1) {
        return t(':name opens the discussion.', { name: named[0] });
    }

    if (named.length > 1) {
        return t(':names open the discussion.', {
            names: listOf(named, locale),
        });
    }

    return spreadOf(result) === null
        ? null
        : t('The lowest and the highest estimates open the discussion.');
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
    const [shownEstimate, setShownEstimate] = useState(estimate);

    if (estimate !== shownEstimate) {
        setShownEstimate(estimate);
        setChoice(null);
    }

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
    // These actions show after the reveal only; plain "r" (reveal) asks for
    // no shift, so the two never answer the same key press.
    useShortcut('shift+r', () => onRevote?.(), {
        scope: actionsRef,
        enabled: shortcuts && !!onRevote && !busy,
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
                    shortcut
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
    shortcut = false,
    onNext,
}: {
    disabled: boolean;
    busy: boolean;
    /** N moves on only once the votes are revealed (ResultActions). */
    shortcut?: boolean;
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
            <TooltipContent shortcut={shortcut ? ['N'] : undefined}>
                {t('Next task')}
            </TooltipContent>
        </Tooltip>
    );
}

function Stat({
    label,
    value,
    note,
    compact = false,
}: {
    label: string;
    value: string;
    note?: string;
    /** A sentence-like value ("50 % on 5") is set smaller than a figure. */
    compact?: boolean;
}) {
    return (
        <div className="flex max-w-full min-w-0 flex-col gap-0.5">
            <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'order-1 truncate font-display font-bold text-foreground',
                    compact ? 'text-xl/9' : 'text-display-lg',
                )}
            >
                {value}
            </dd>
            {note !== undefined && (
                <dd className="order-3 text-xs text-muted-foreground">
                    {note}
                </dd>
            )}
        </div>
    );
}

/**
 * Lowest and highest estimate that got a vote: the figures the server sends
 * when it sends them, otherwise the ends of the distribution, which is in
 * deck order, so no value is parsed as a number here.
 */
function spreadOf(
    result: PokerResult,
    locale?: string,
): [PokerValue, PokerValue] | null {
    if (result.spread) {
        return result.spread.min === result.spread.max
            ? null
            : [
                  formatNumber(result.spread.min, locale),
                  formatNumber(result.spread.max, locale),
              ];
    }

    const played = result.distribution
        .filter((entry) => entry.count > 0 && !isSpecialCard(entry.value))
        .map((entry) => entry.value);

    return played.length > 1 ? [played[0], played[played.length - 1]] : null;
}

/** "Consensus", the spread of a round that needs a discussion, or that it needs one. */
function verdictOf(t: Translate, result: PokerResult, locale?: string): string {
    if (result.consensus) {
        return t('Consensus');
    }

    const spread = spreadOf(result, locale);

    return spread
        ? t('Spread :min → :max', { min: spread[0], max: spread[1] })
        : t('Needs discussion');
}

export function agreementOf(t: Translate, result: PokerResult): string | null {
    if (result.agreement === undefined || result.agreement === null) {
        return null;
    }

    const percent = Math.round(result.agreement * 100);

    return result.mode.length > 0
        ? t(':percent % on :value', {
              percent,
              value: result.mode.join(', '),
          })
        : t(':percent %', { percent });
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
    headingId,
    className,
    ...actions
}: PokerResultPanelProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const titleId = headingId ?? generatedId;
    const voteCount = result.distribution.reduce(
        (sum, entry) => sum + entry.count,
        0,
    );
    const countable = hasCountableVotes(result);
    const agreement = agreementOf(t, result);
    const sentence = countable
        ? discussionSentence(t, result, seats, story, anonymous, locale)
        : null;

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            data-slot="poker-result"
            data-consensus={result.consensus}
            className={cn(
                'flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h3
                    id={titleId}
                    className="min-w-0 text-ui-lg font-semibold text-foreground"
                >
                    {t(
                        voteCount === 1
                            ? 'Result · :count vote'
                            : 'Result · :count votes',
                        { count: voteCount },
                    )}
                </h3>
                {countable && (
                    <ConsensusBadge consensus={result.consensus}>
                        {verdictOf(t, result, locale)}
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
            <div className="flex min-w-0 flex-col gap-4 @2xl/poker:flex-row @2xl/poker:items-end @2xl/poker:justify-between @2xl/poker:gap-8">
                {countable ? (
                    <dl className="flex min-w-0 flex-wrap gap-x-8 gap-y-4">
                        {showsAverage(result, actions.isNumeric) &&
                            result.average !== null && (
                                <Stat
                                    label={t('Average')}
                                    value={formatNumber(result.average, locale)}
                                    note={
                                        result.nearestCard !== null
                                            ? t('Nearest card: :card', {
                                                  card: result.nearestCard,
                                              })
                                            : undefined
                                    }
                                />
                            )}
                        {result.median !== undefined &&
                            result.median !== null && (
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
                        {agreement !== null && (
                            <Stat
                                compact
                                label={t('Agreement')}
                                value={agreement}
                            />
                        )}
                    </dl>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {t('No countable votes')}
                    </p>
                )}
                <PokerDistribution result={result} />
            </div>
            {sentence !== null && (
                <p
                    data-slot="poker-result-next"
                    className="text-sm text-muted-foreground"
                >
                    {sentence}
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

/**
 * Who watches without a seat: the dashed box under the seats, so that the
 * oval stays near the story.
 */
function WatchingRow({
    watchers,
    facilitatorId,
    seatMenu,
}: {
    watchers: PokerSeat[];
    facilitatorId?: string | null;
    seatMenu?: (seat: PokerSeat) => ReactNode;
}) {
    const { t } = useTrans();

    return (
        <section
            aria-label={t('Watching')}
            data-slot="poker-watching"
            className="flex max-w-full min-w-0 flex-col gap-2 self-start rounded-lg border-2 border-dashed border-input bg-card/70 px-3 py-2"
        >
            <h3 className="flex items-center gap-1.5 text-overline font-semibold tracking-widest text-muted-foreground uppercase">
                <Eye aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{t('Watching')}</span>
            </h3>
            <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
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
                        {facilitatorId != null &&
                            seat.user.id === facilitatorId && (
                                <Crown
                                    role="img"
                                    aria-label={t('Facilitator')}
                                    className="size-3 shrink-0 text-skrum-warning-text"
                                />
                            )}
                        <span className="truncate text-sm font-medium">
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
    showStory = true,
    resultId,
    showResult = true,
    seatsLayout = 'table',
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
    const isRow = seatsLayout === 'row';
    const isOval = !isRow && players.length <= MaxOvalSeats;
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

        if (revealed && !showResult) {
            return;
        }

        const target = revealed
            ? (resultRef.current ?? seatsRef.current)
            : seatsRef.current;

        target?.focus();
    }, [revealed, showResult]);

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
                ? t('Average: :value', {
                      value: formatNumber(result.average, locale),
                  })
                : t('Most played: :cards', { cards: result.mode.join(', ') });
        const verdict = result.consensus
            ? t('Consensus')
            : t('Needs discussion');

        return `${t('Votes revealed')}. ${headline}. ${verdict}`;
    };

    const renderSeat = (index: number, reverse?: boolean) => (
        <SeatView
            compact={isRow}
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
            showStory={showStory}
            summary={!showResult}
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
            {isRow && (
                <section
                    ref={seatsRef}
                    tabIndex={-1}
                    aria-label={seatsLabel}
                    data-layout="row"
                    className={cn('flex min-w-0 flex-col gap-3', seatsFocus)}
                >
                    <div
                        data-slot="poker-row-head"
                        className="flex min-w-0 items-center gap-2"
                    >
                        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {seatsLabel}
                        </h2>
                        {!revealed && (
                            <span
                                data-slot="poker-progress"
                                className="shrink-0 text-sm font-semibold text-foreground"
                            >
                                {t(':voted of :total voted', {
                                    voted: votedCount,
                                    total: presentCount,
                                })}
                            </span>
                        )}
                    </div>
                    <div
                        role="group"
                        tabIndex={0}
                        aria-label={t(':label, scrolls sideways', {
                            label: seatsLabel,
                        })}
                        data-slot="poker-seats-row"
                        className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain rounded-lg px-1 pt-1 pb-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        {players.map((_, index) => renderSeat(index))}
                    </div>
                    {!revealed && isFacilitator && onReveal && (
                        <div className="flex justify-center">
                            <RevealButton
                                canReveal={!busy && hasVotes}
                                onReveal={onReveal}
                            />
                        </div>
                    )}
                </section>
            )}
            {isOval && (
                <section
                    ref={seatsRef}
                    tabIndex={-1}
                    aria-label={seatsLabel}
                    data-layout="oval"
                    className={cn(
                        seatGrid,
                        seatsFocus,
                        '@md/poker:grid-cols-[6rem_minmax(0,1fr)_6rem] @md/poker:grid-rows-[auto_minmax(8.25rem,auto)_auto] @md/poker:items-center',
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
            )}
            {!isRow && !isOval && (
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
            {watchers.length > 0 && (
                <WatchingRow
                    watchers={watchers}
                    facilitatorId={facilitatorId}
                    seatMenu={seatMenu}
                />
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
            {showResult && revealed && result && (
                <PokerResultPanel
                    key={story.key ?? story.title}
                    sectionRef={resultRef}
                    headingId={resultId}
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
            {showResult && revealed && !result && isFacilitator && (
                <ResultActions key={story.key ?? story.title} {...actions} />
            )}
        </div>
    );
}
