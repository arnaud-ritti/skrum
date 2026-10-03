import { EyeOff, Lock, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useId, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { cn } from '@/lib/utils';

export type SurveyQuestionKind =
    | 'single'
    | 'multiple'
    | 'text'
    | 'scale5'
    | 'nps';

export type SurveyQuestionValue = string | number | string[] | null;

export type SurveyQuestionVoter = {
    id: string;
    name: string;
    avatarUrl?: string | null;
};

export type SurveyQuestionOption = {
    id: string;
    label: string;
    count?: number | null;
    voters?: SurveyQuestionVoter[] | null;
};

export type SurveyQuestionBucket = {
    key: string;
    label: string;
    count: number;
};

export type SurveyQuestionTextAnswer = {
    id: string;
    text: string;
    authorName?: string | null;
    isMine?: boolean;
};

export type SurveyQuestionSegments = {
    detractors: number;
    passives: number;
    promoters: number;
};

export type SurveyQuestionDelta = {
    value: number;
    /** The name of what the figure is compared with. */
    against: string;
};

export type SurveyQuestionResults = {
    responses: number;
    hidden?: boolean;
    mean?: number;
    /** The most frequent answer of a scale, beside its mean. */
    mode?: number | null;
    nps?: number;
    segments?: SurveyQuestionSegments;
    delta?: SurveyQuestionDelta | null;
    buckets?: SurveyQuestionBucket[];
    textAnswers?: SurveyQuestionTextAnswer[] | null;
    keywords?: { word: string; weight: 1 | 2 | 3 }[];
    quotes?: string[];
};

type SurveyQuestionOwnProps = {
    id: string;
    kind: SurveyQuestionKind;
    label: string;
    mode: 'answer' | 'results';
    description?: string | null;
    index?: number;
    count?: number;
    options?: SurveyQuestionOption[];
    maxChoices?: number;
    scaleLabels?: [min: string, max: string];
    anonymous?: boolean;
    required?: boolean;
    invalid?: boolean;
    closed?: boolean;
    /** Answering is not possible here, though the survey is still open. */
    disabled?: boolean;
    busy?: boolean;
    hasAnswered?: boolean;
    /** The draft holds nothing new to send. */
    submitDisabled?: boolean;
    maxLength?: number;
    value?: SurveyQuestionValue;
    /** The optional comment of a scale or NPS answer, shown with `onCommentChange`. */
    comment?: string;
    onCommentChange?: (value: string) => void;
    /** `none`: the control and its helper lines only, named by `labelledBy`. */
    chrome?: 'card' | 'none';
    labelledBy?: string;
    /** The answer the server holds, when `value` is a draft of it. */
    savedValue?: SurveyQuestionValue;
    results?: SurveyQuestionResults;
    onChange?: (value: SurveyQuestionValue) => void;
    onSubmit?: () => void;
    onWithdraw?: () => void;
    actions?: ReactNode;
    footer?: ReactNode;
    className?: string;
};

/** The other props (`aria-label`, `data-test`…) go to the `<article>`. */
export type SurveyQuestionProps = SurveyQuestionOwnProps &
    Omit<
        ComponentProps<'article'>,
        keyof SurveyQuestionOwnProps | 'children' | 'onKeyDown'
    >;

const collapsedAnswerCount = 5;
const commentMaxLength = 500;
const npsValues = Array.from({ length: 11 }, (_, value) => value);
const scaleValues = [1, 2, 3, 4, 5];

const textEntrySelector =
    'textarea, select, input:not([type="radio"]):not([type="checkbox"]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';

function isTextEntry(target: Node): boolean {
    return (
        target instanceof Element && target.closest(textEntrySelector) !== null
    );
}

function percentOf(count: number, total: number): number {
    if (total <= 0) {
        return 0;
    }

    return Math.min(100, Math.round((count / total) * 100));
}

function ResultBar({
    percent,
    isLeading,
}: {
    percent: number;
    isLeading: boolean;
}) {
    return (
        <div
            data-slot="survey-result-bar"
            aria-hidden="true"
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        >
            <div
                className={cn(
                    'h-full rounded-full bg-chart-1 transition-[width] duration-220 ease-standard motion-reduce:transition-none',
                    !isLeading && 'opacity-45',
                )}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

function Voters({ voters }: { voters: SurveyQuestionVoter[] }) {
    if (voters.length === 0) {
        return null;
    }

    return (
        <ul data-slot="survey-voters" className="flex -space-x-1">
            {voters.map((voter) => (
                <li key={voter.id}>
                    <PersonAvatar
                        name={voter.name}
                        src={voter.avatarUrl}
                        size="xs"
                        title={voter.name}
                        imgProps={{ alt: voter.name }}
                    />
                </li>
            ))}
        </ul>
    );
}

function CountResults({
    items,
    total,
    selectedKeys,
    asCount,
}: {
    items: {
        key: string;
        label: string;
        /** `null`: the figure is not given to this viewer, the label stands alone. */
        count: number | null;
        voters?: SurveyQuestionVoter[] | null;
    }[];
    total: number;
    selectedKeys: string[];
    asCount: boolean;
}) {
    const { t } = useTrans();
    const highest = Math.max(0, ...items.map((item) => item.count ?? 0));

    return (
        <ul className="flex flex-col gap-3">
            {items.map((item) => {
                const isMine = selectedKeys.includes(item.key);

                if (item.count === null) {
                    return (
                        <li
                            key={item.key}
                            data-slot="survey-result"
                            className="min-w-0 text-sm break-words"
                        >
                            {item.label}
                        </li>
                    );
                }

                const percent = percentOf(item.count, total);

                return (
                    <li
                        key={item.key}
                        data-slot="survey-result"
                        className="flex min-w-0 flex-col gap-1"
                    >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 break-words">
                                {item.label}
                                {isMine && (
                                    <span className="ms-2 text-xs text-muted-foreground">
                                        {t('Your answer')}
                                    </span>
                                )}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {asCount
                                    ? `${item.count} · ${percent}%`
                                    : `${percent}% · ${item.count}`}
                            </span>
                        </div>
                        <ResultBar
                            percent={percent}
                            isLeading={item.count === highest && highest > 0}
                        />
                        {item.voters && <Voters voters={item.voters} />}
                    </li>
                );
            })}
        </ul>
    );
}

function NpsHistogram({ buckets }: { buckets: SurveyQuestionBucket[] }) {
    const { t } = useTrans();
    const highest = Math.max(1, ...buckets.map((bucket) => bucket.count));
    const description = buckets
        .map((bucket) => `${bucket.label}: ${bucket.count}`)
        .join(', ');

    return (
        <div
            role="img"
            aria-label={t('NPS distribution: :values', { values: description })}
            data-slot="survey-nps-histogram"
            className="flex h-24 items-end gap-1"
        >
            {buckets.map((bucket) => {
                const score = Number(bucket.key);
                const tone =
                    score <= 6
                        ? 'bg-skrum-roti-1'
                        : score <= 8
                          ? 'bg-skrum-roti-3'
                          : 'bg-skrum-roti-5';

                return (
                    <div
                        key={bucket.key}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                        <div
                            className={cn('w-full rounded-t-sm', tone)}
                            style={{
                                height: `${percentOf(bucket.count, highest)}%`,
                            }}
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {bucket.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function TextResults({ results }: { results: SurveyQuestionResults }) {
    const { t } = useTrans();
    const [expanded, setExpanded] = useState(false);
    const answers = results.textAnswers ?? [];
    const quotes = results.quotes ?? [];
    const keywords = results.keywords ?? [];
    const hiddenCount = Math.max(0, answers.length - collapsedAnswerCount);
    const visibleAnswers = expanded
        ? answers
        : answers.slice(0, collapsedAnswerCount);

    return (
        <div className="flex flex-col gap-3">
            {keywords.length > 0 && (
                <ul
                    aria-label={t('Keywords')}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                >
                    {keywords.map((keyword) => (
                        <li
                            key={keyword.word}
                            className={cn(
                                'text-skrum-primary-text',
                                keyword.weight === 1 && 'text-sm',
                                keyword.weight === 2 && 'text-base font-medium',
                                keyword.weight === 3 && 'text-lg font-semibold',
                            )}
                        >
                            {keyword.word}
                        </li>
                    ))}
                </ul>
            )}
            {quotes.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {quotes.map((quote) => (
                        <li
                            key={quote}
                            className="border-s-2 border-primary ps-3 text-sm break-words whitespace-pre-wrap text-muted-foreground"
                        >
                            {quote}
                        </li>
                    ))}
                </ul>
            )}
            {results.textAnswers && answers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t('No answers yet.')}
                </p>
            )}
            {answers.length > 0 && (
                <ul aria-label={t('Answers')} className="flex flex-col gap-1">
                    {visibleAnswers.map((answer) => (
                        <li
                            key={answer.id}
                            className={cn(
                                'rounded-sm border border-border px-2 py-1 text-xs break-words whitespace-pre-wrap',
                                answer.isMine && 'border-primary',
                            )}
                        >
                            {answer.text}
                            {answer.authorName && (
                                <span className="block text-muted-foreground">
                                    {answer.authorName}
                                </span>
                            )}
                            {answer.isMine && (
                                <span className="block text-muted-foreground">
                                    {t('Your answer')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {hiddenCount > 0 && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto self-start p-0 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((value) => !value)}
                >
                    <span className="truncate">
                        {expanded
                            ? t('Show fewer')
                            : t('See :count more', { count: hiddenCount })}
                    </span>
                </Button>
            )}
        </div>
    );
}

function formatDelta(value: number): string {
    const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);

    return value > 0 ? `+${rounded}` : rounded;
}

function DeltaBadge({ delta }: { delta: SurveyQuestionDelta }) {
    const { t } = useTrans();

    if (delta.value === 0) {
        return (
            <Badge
                variant="muted"
                data-slot="survey-delta"
                data-trend="flat"
                icon={Minus}
                className="mb-1"
            >
                <span className="truncate">{t('no change')}</span>
            </Badge>
        );
    }

    const isRise = delta.value > 0;

    return (
        <Badge
            variant={isRise ? 'success' : 'destructive'}
            data-slot="survey-delta"
            data-trend={isRise ? 'up' : 'down'}
            icon={isRise ? TrendingUp : TrendingDown}
            className="mb-1"
        >
            <span className="truncate">
                {t(':value vs :title', {
                    value: formatDelta(delta.value),
                    title: delta.against,
                })}
            </span>
        </Badge>
    );
}

function NpsSegments({ segments }: { segments: SurveyQuestionSegments }) {
    const { t } = useTrans();
    const total = segments.detractors + segments.passives + segments.promoters;
    const parts = [
        {
            key: 'detractors',
            count: segments.detractors,
            tone: 'bg-destructive text-destructive-foreground',
            legend: t('Detractors · 0–6'),
        },
        {
            key: 'passives',
            count: segments.passives,
            tone: 'bg-muted text-muted-foreground ring-1 ring-border ring-inset',
            legend: t('Passives · 7–8'),
        },
        {
            key: 'promoters',
            count: segments.promoters,
            tone: 'bg-skrum-success text-skrum-success-foreground',
            legend: t('Promoters · 9–10'),
        },
    ];

    return (
        <div className="flex flex-col gap-2">
            <div
                role="img"
                aria-label={t(
                    ':detractors detractors, :passives passives, :promoters promoters',
                    { ...segments },
                )}
                data-slot="survey-nps-segments"
                className="flex h-7 gap-0.5 overflow-hidden rounded-md bg-muted"
            >
                {parts
                    .filter((part) => part.count > 0)
                    .map((part) => (
                        <span
                            key={part.key}
                            className={cn(
                                'grid min-w-0 place-items-center text-xs font-bold tabular-nums',
                                part.tone,
                            )}
                            style={{ flexGrow: part.count, flexBasis: 0 }}
                        >
                            <span className="truncate">
                                {percentOf(part.count, total)}%
                            </span>
                        </span>
                    ))}
            </div>
            <dl className="grid grid-cols-3 gap-2">
                {parts.map((part) => (
                    <div
                        key={part.key}
                        className="flex min-w-0 flex-col-reverse gap-0.5 text-xs text-muted-foreground"
                    >
                        <dt className="min-w-0 break-words">{part.legend}</dt>
                        <dd className="text-base font-semibold text-foreground tabular-nums">
                            {part.count}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function Results({
    kind,
    options,
    results,
    value,
}: {
    kind: SurveyQuestionKind;
    options: SurveyQuestionOption[];
    results: SurveyQuestionResults;
    value: SurveyQuestionValue;
}) {
    const { t } = useTrans();

    if (results.hidden) {
        return (
            <p
                data-slot="survey-results-hidden"
                className="flex items-center gap-2 text-sm text-muted-foreground"
            >
                <EyeOff className="size-4 shrink-0" />
                <span>{t('Results are not visible yet.')}</span>
            </p>
        );
    }

    if (kind === 'text') {
        return <TextResults results={results} />;
    }

    if (kind === 'scale5' || kind === 'nps') {
        const buckets = results.buckets ?? [];
        const keyNumber = typeof value === 'number' ? String(value) : null;

        return (
            <div className="flex flex-col gap-3">
                {(results.mean !== undefined || results.nps !== undefined) && (
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                        {kind === 'scale5' && results.mean !== undefined && (
                            <p
                                data-slot="survey-key-figure"
                                className="font-display text-3xl font-semibold tabular-nums"
                            >
                                <span className="sr-only">
                                    {t('Average')}:{' '}
                                </span>
                                {results.mean.toFixed(1)}
                                <span className="text-base text-muted-foreground">
                                    {' / 5'}
                                </span>
                            </p>
                        )}
                        {kind === 'scale5' &&
                            results.mode !== undefined &&
                            results.mode !== null && (
                                <p
                                    data-slot="survey-key-figure-mode"
                                    className="flex flex-col"
                                >
                                    <span className="font-display text-3xl font-semibold tabular-nums">
                                        {results.mode}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('most frequent answer')}
                                    </span>
                                </p>
                            )}
                        {kind === 'nps' && results.nps !== undefined && (
                            <p
                                data-slot="survey-key-figure"
                                className="font-display text-3xl font-semibold tabular-nums"
                            >
                                <span className="sr-only">
                                    {t('NPS score')}:{' '}
                                </span>
                                {results.nps}
                            </p>
                        )}
                        {results.delta && <DeltaBadge delta={results.delta} />}
                    </div>
                )}
                {kind === 'nps' && results.segments && (
                    <NpsSegments segments={results.segments} />
                )}
                {kind === 'nps' ? (
                    <NpsHistogram buckets={buckets} />
                ) : (
                    <CountResults
                        items={buckets}
                        total={results.responses}
                        selectedKeys={keyNumber === null ? [] : [keyNumber]}
                        asCount={false}
                    />
                )}
            </div>
        );
    }

    const selected = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? [value]
          : [];

    return (
        <CountResults
            items={options.map((option) => ({
                key: option.id,
                label: option.label,
                count: option.count === null ? null : (option.count ?? 0),
                voters: option.voters,
            }))}
            total={results.responses}
            selectedKeys={selected}
            asCount
        />
    );
}

function ScaleControl({
    name,
    labelId,
    describedBy,
    values,
    value,
    disabled,
    labels,
    onPick,
}: {
    name: string;
    labelId: string;
    describedBy?: string;
    values: number[];
    value: SurveyQuestionValue;
    disabled: boolean;
    labels?: [string, string];
    onPick: (value: number) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div
                role="radiogroup"
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                className="flex flex-wrap gap-1"
            >
                {values.map((scaleValue) => (
                    <label
                        key={scaleValue}
                        className={cn(
                            'relative flex h-9 min-w-9 flex-1 cursor-pointer items-center justify-center rounded-md border border-input bg-card px-2 text-sm font-medium tabular-nums transition-colors duration-140 ease-standard',
                            'has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground',
                            'has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
                            'has-disabled:cursor-not-allowed has-disabled:opacity-55',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={scaleValue}
                            checked={value === scaleValue}
                            disabled={disabled}
                            className="sr-only"
                            onChange={() => onPick(scaleValue)}
                        />
                        <span>{scaleValue}</span>
                    </label>
                ))}
            </div>
            {labels && (
                <div
                    id={describedBy}
                    className="flex justify-between gap-3 text-xs text-muted-foreground"
                >
                    <span className="min-w-0 truncate">{labels[0]}</span>
                    <span className="min-w-0 truncate text-end">
                        {labels[1]}
                    </span>
                </div>
            )}
        </div>
    );
}

export function SurveyQuestion({
    id,
    kind,
    label,
    mode,
    description,
    index,
    count,
    options = [],
    maxChoices,
    scaleLabels,
    anonymous = false,
    required = false,
    invalid = false,
    closed = false,
    disabled: blocked = false,
    busy = false,
    hasAnswered = false,
    submitDisabled = false,
    maxLength = 500,
    value = null,
    comment = '',
    onCommentChange,
    chrome = 'card',
    labelledBy,
    savedValue,
    results,
    onChange,
    onSubmit,
    onWithdraw,
    actions,
    footer,
    className,
    ...props
}: SurveyQuestionProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const isBare = chrome === 'none';
    const labelId = isBare && labelledBy ? labelledBy : `${generatedId}-label`;
    const commentId = `${generatedId}-comment`;
    const scaleLabelsId = `${generatedId}-scale`;
    const errorId = `${generatedId}-error`;
    const isInert = closed || blocked;
    const disabled = isInert || busy;
    const isAnswer = mode === 'answer';
    const selectedIds = Array.isArray(value)
        ? value
        : typeof value === 'string' && kind !== 'text'
          ? [value]
          : [];
    const limitReached =
        maxChoices !== undefined && selectedIds.length >= maxChoices;
    const textValue = typeof value === 'string' ? value : '';
    const trimmedText = textValue.trim();

    const kindLabels: Record<SurveyQuestionKind, string> = {
        single: t('Single choice'),
        multiple: t('Multiple choice'),
        text: t('Free text'),
        scale5: t('Scale 1 to 5'),
        nps: t('NPS 0 to 10'),
    };

    const handleDigitKey = (event: KeyboardEvent<HTMLElement>): void => {
        if (
            !isAnswer ||
            disabled ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
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

        if (isTextEntry(event.target)) {
            return;
        }

        const digit = Number(event.key);

        if (!Number.isInteger(digit) || digit < 1 || digit > 5) {
            return;
        }

        if (!singleKeyShortcutsEnabled()) {
            return;
        }

        if (kind === 'scale5') {
            event.preventDefault();
            onChange?.(digit);

            return;
        }

        if (kind === 'nps') {
            event.preventDefault();
            onChange?.(digit);

            return;
        }

        const option = options[digit - 1];

        if (kind === 'single' && option) {
            event.preventDefault();
            onChange?.(option.id);
        }
    };

    const toggleOption = (optionId: string, checked: boolean): void => {
        const next = checked
            ? [...selectedIds, optionId]
            : selectedIds.filter((selectedId) => selectedId !== optionId);

        onChange?.(next);
    };

    const needsSubmit = kind === 'multiple' || kind === 'text';
    const canSubmit =
        kind === 'text' ? trimmedText !== '' : selectedIds.length > 0;

    const controls = (
        <>
            {isAnswer && kind === 'scale5' && (
                <ScaleControl
                    name={id}
                    labelId={labelId}
                    describedBy={scaleLabels ? scaleLabelsId : undefined}
                    values={scaleValues}
                    value={value}
                    disabled={disabled}
                    labels={scaleLabels}
                    onPick={(picked) => onChange?.(picked)}
                />
            )}

            {isAnswer && kind === 'nps' && (
                <ScaleControl
                    name={id}
                    labelId={labelId}
                    describedBy={scaleLabels ? scaleLabelsId : undefined}
                    values={npsValues}
                    value={value}
                    disabled={disabled}
                    labels={scaleLabels}
                    onPick={(picked) => onChange?.(picked)}
                />
            )}

            {isAnswer && kind === 'single' && (
                <div
                    role="radiogroup"
                    aria-labelledby={labelId}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}
                    className="flex flex-col gap-2"
                >
                    {options.map((option) => (
                        <label
                            key={option.id}
                            className={cn(
                                'flex min-w-0 cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors duration-140 ease-standard',
                                'has-checked:border-primary has-checked:bg-skrum-primary-soft has-checked:text-skrum-primary-text',
                                'has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
                                'has-disabled:cursor-not-allowed has-disabled:opacity-55',
                            )}
                        >
                            <input
                                type="radio"
                                name={id}
                                value={option.id}
                                checked={selectedIds[0] === option.id}
                                disabled={disabled}
                                className="size-4 shrink-0 accent-primary"
                                onChange={() => onChange?.(option.id)}
                            />
                            <span className="min-w-0 flex-1 break-words">
                                {option.label}
                            </span>
                        </label>
                    ))}
                </div>
            )}

            {isAnswer && kind === 'multiple' && (
                <div
                    role="group"
                    aria-labelledby={labelId}
                    aria-describedby={invalid ? errorId : undefined}
                    className="flex flex-col gap-2"
                >
                    {maxChoices !== undefined && (
                        <p className="text-xs text-muted-foreground">
                            {t(':count max', { count: maxChoices })}
                        </p>
                    )}
                    {options.map((option) => {
                        const isChecked = selectedIds.includes(option.id);

                        return (
                            <label
                                key={option.id}
                                className={cn(
                                    'flex min-w-0 cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors duration-140 ease-standard',
                                    isChecked &&
                                        'border-primary bg-skrum-primary-soft text-skrum-primary-text',
                                    'has-disabled:cursor-not-allowed has-disabled:opacity-55',
                                )}
                            >
                                <Checkbox
                                    checked={isChecked}
                                    disabled={
                                        disabled || (limitReached && !isChecked)
                                    }
                                    onCheckedChange={(checked) =>
                                        toggleOption(
                                            option.id,
                                            checked === true,
                                        )
                                    }
                                />
                                <span className="min-w-0 flex-1 break-words">
                                    {option.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}

            {isAnswer && kind === 'text' && (
                <div className="flex flex-col gap-1">
                    <Textarea
                        value={textValue}
                        maxLength={maxLength}
                        rows={3}
                        disabled={disabled}
                        aria-labelledby={labelId}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? errorId : undefined}
                        placeholder={t('Write your answer…')}
                        onChange={(event) => onChange?.(event.target.value)}
                    />
                    <p
                        data-slot="survey-char-counter"
                        className="self-end text-xs text-muted-foreground tabular-nums"
                    >
                        {textValue.length} / {maxLength}
                    </p>
                </div>
            )}

            {isAnswer && invalid && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-skrum-destructive-text"
                >
                    {t('An answer is required.')}
                </p>
            )}

            {isAnswer && needsSubmit && onSubmit && !isInert && (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy || !canSubmit || submitDisabled}
                        onClick={onSubmit}
                    >
                        <span className="truncate">
                            {hasAnswered ? t('Update answer') : t('Submit')}
                        </span>
                    </Button>
                </div>
            )}

            {isAnswer &&
                (kind === 'scale5' || kind === 'nps') &&
                onCommentChange && (
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor={commentId}
                            className="text-sm font-medium"
                        >
                            {t('Why this score? (optional)')}
                        </label>
                        <Textarea
                            id={commentId}
                            value={comment}
                            maxLength={commentMaxLength}
                            rows={3}
                            disabled={disabled}
                            onChange={(event) =>
                                onCommentChange(event.target.value)
                            }
                        />
                    </div>
                )}
        </>
    );

    if (isBare) {
        return (
            <div
                data-slot="survey-question"
                data-kind={kind}
                data-mode={mode}
                data-chrome="none"
                {...(props as ComponentProps<'div'>)}
                onKeyDown={handleDigitKey}
                className={cn('flex min-w-0 flex-col gap-3', className)}
            >
                {controls}
            </div>
        );
    }

    return (
        <article
            data-slot="survey-question"
            data-kind={kind}
            data-mode={mode}
            aria-labelledby={labelId}
            {...props}
            onKeyDown={handleDigitKey}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-card',
                className,
            )}
        >
            <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {index !== undefined && count !== undefined && (
                        <span className="tabular-nums">
                            {t(':index / :count', { index, count })}
                        </span>
                    )}
                    <Badge variant="muted">
                        <span className="truncate">{kindLabels[kind]}</span>
                    </Badge>
                    {anonymous && (
                        <Badge variant="outline">
                            <EyeOff />
                            <span className="truncate">{t('Anonymous')}</span>
                        </Badge>
                    )}
                    {closed && (
                        <Badge variant="secondary">
                            <Lock />
                            <span className="truncate">{t('Closed')}</span>
                        </Badge>
                    )}
                    {actions && <div className="ms-auto">{actions}</div>}
                </div>
                <h3
                    id={labelId}
                    className="font-display text-base font-semibold break-words"
                >
                    {label}
                    {required && isAnswer && (
                        <span className="ms-1 text-xs font-normal text-muted-foreground">
                            {t('Required')}
                        </span>
                    )}
                </h3>
                {description && (
                    <p className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
                        {description}
                    </p>
                )}
            </header>

            {controls}

            {results && (!isAnswer || !results.hidden) && (
                <Results
                    kind={kind}
                    options={options}
                    results={results}
                    value={savedValue === undefined ? value : savedValue}
                />
            )}

            {(results || (isAnswer && hasAnswered && onWithdraw)) && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {results ? (
                        <span data-slot="survey-response-count">
                            {results.responses === 1
                                ? t('1 response')
                                : t(':count responses', {
                                      count: results.responses,
                                  })}
                        </span>
                    ) : (
                        <span />
                    )}
                    {isAnswer && hasAnswered && onWithdraw && !isInert && (
                        <Button
                            type="button"
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            disabled={busy}
                            onClick={onWithdraw}
                        >
                            <span className="truncate">
                                {t('Withdraw my answer')}
                            </span>
                        </Button>
                    )}
                </div>
            )}

            {footer}
        </article>
    );
}
