import { usePage } from '@inertiajs/react';
import { ChartColumn, RotateCcw, Table } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSurveyComparison } from '@/hooks/use-survey-comparison';
import type { ComparisonLoad } from '@/hooks/use-survey-comparison';
import { useTrans } from '@/hooks/use-trans';
import { signed } from '@/lib/surveys/compare';
import { cn } from '@/lib/utils';
import type {
    SurveyComparable,
    SurveyComparison,
    SurveyComparisonPair,
    SurveyKind,
} from '@/lib/surveys/types';

type ResultsCompareProps = {
    surveyId: string;
    comparable: SurveyComparable | null;
    /** The default comparison, already asked for by the page for the badges. */
    defaultLoad?: ComparisonLoad;
    onRetryDefault?: () => void;
};

type ChoicePercent = { id: string; label: string; percent: number };

type Share = { key: string; label: string; percent: number };

type CompareView = 'chart' | 'table';

/** One category of a chart: its value in this survey and in the other. */
type Category = {
    key: string;
    label: string;
    now: number | null;
    before: number | null;
};

/**
 * The two surveys in one chart: a column pair per value of a scale or an
 * NPS, a bar pair per option, per mean or per number of answers.
 */
type CompareChartModel = {
    orientation: 'columns' | 'rows';
    /** The heading of the first column of the table. */
    header: string;
    categories: Category[];
    max: number;
    format: (value: number) => string;
};

const SkeletonRows = 3;

const Missing = '—';

function numberOf(values: Record<string, unknown>, key: string): number | null {
    const value = values[key];

    return typeof value === 'number' ? value : null;
}

function percentsOf(values: Record<string, unknown>): ChoicePercent[] {
    const options = values.options;

    return Array.isArray(options) ? (options as ChoicePercent[]) : [];
}

function sharesOf(values: Record<string, unknown>): Share[] {
    const shares = values.shares;

    return Array.isArray(shares) ? (shares as Share[]) : [];
}

function highestOf(categories: Category[], floor: number): number {
    return Math.max(
        floor,
        ...categories.flatMap((category) => [
            category.now ?? 0,
            category.before ?? 0,
        ]),
    );
}

function useKindLabels(): Record<SurveyKind, string> {
    const { t } = useTrans();

    return {
        scale: t('Scale 1 to 5'),
        nps: t('NPS 0 to 10'),
        single: t('Single choice'),
        multiple: t('Multiple choice'),
        text: t('Free text'),
    };
}

function useFormatDate(): (iso: string) => string {
    const { locale } = usePage().props as { locale?: string };

    return (iso) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(iso),
        );
}

const percent = (value: number): string => `${value}%`;

const onFive = (value: number): string => `${value.toFixed(1)} / 5`;

/** The distribution of a scale or an NPS, value by value, when both surveys have the same values. */
function distributionOf(
    pair: SurveyComparisonPair,
    header: string,
): CompareChartModel | null {
    const now = sharesOf(pair.current);
    const before = sharesOf(pair.other);

    if (now.length === 0 || now.length !== before.length) {
        return null;
    }

    const categories = now.map((share, index) => ({
        key: share.key,
        label: share.label,
        now: share.percent,
        before: before[index].percent,
    }));

    return {
        orientation: 'columns',
        header,
        categories,
        max: highestOf(categories, 1),
        format: percent,
    };
}

function useChartOf(): (
    pair: SurveyComparisonPair,
) => CompareChartModel | null {
    const { t } = useTrans();

    return (pair) => {
        switch (pair.kind) {
            case 'scale':
                return (
                    distributionOf(pair, t('Value')) ?? {
                        orientation: 'rows',
                        header: t('Value'),
                        categories: [
                            {
                                key: 'mean',
                                label: t('Average'),
                                now: numberOf(pair.current, 'mean'),
                                before: numberOf(pair.other, 'mean'),
                            },
                        ],
                        max: 5,
                        format: onFive,
                    }
                );
            case 'nps':
                return distributionOf(pair, t('Value'));
            case 'text': {
                const categories = [
                    {
                        key: 'answers',
                        label: t('Answers'),
                        now: numberOf(pair.current, 'responses') ?? 0,
                        before: numberOf(pair.other, 'responses') ?? 0,
                    },
                ];

                return {
                    orientation: 'rows',
                    header: t('Value'),
                    categories,
                    max: highestOf(categories, 1),
                    format: String,
                };
            }
            case 'single':
            case 'multiple': {
                const deltas = Array.isArray(pair.delta) ? pair.delta : [];

                if (deltas.length === 0) {
                    return null;
                }

                const deltaById = new Map(
                    deltas.map((option) => [option.optionId, option.delta]),
                );
                const categories = percentsOf(pair.current).map((option) => {
                    const delta = deltaById.get(option.id);

                    return {
                        key: option.id,
                        label: option.label,
                        now: option.percent,
                        before:
                            delta === undefined ? null : option.percent - delta,
                    };
                });

                return {
                    orientation: 'rows',
                    header: t('Option'),
                    categories,
                    max: 100,
                    format: percent,
                };
            }
        }
    };
}

const SeriesTone = {
    now: 'bg-chart-1',
    before: 'bg-chart-1/40',
} as const;

function heightOf(value: number | null, max: number): string {
    return `${value === null ? 0 : Math.min(100, Math.round((value / max) * 100))}%`;
}

function Legend() {
    const { t } = useTrans();

    return (
        <ul
            data-slot="survey-compare-legend"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
            {(['now', 'before'] as const).map((series) => (
                <li key={series} className="flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className={cn(
                            'size-2.5 rounded-xs',
                            SeriesTone[series],
                        )}
                    />
                    {series === 'now' ? t('Now') : t('Before')}
                </li>
            ))}
        </ul>
    );
}

function CompareChart({ model }: { model: CompareChartModel }) {
    if (model.orientation === 'columns') {
        return (
            <div
                aria-hidden="true"
                data-slot="survey-compare-chart"
                data-orientation="columns"
                className="flex flex-col gap-1"
            >
                <div className="flex h-30 items-end gap-2 border-b border-border">
                    {model.categories.map((category) => (
                        <div
                            key={category.key}
                            className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5"
                        >
                            {(['now', 'before'] as const).map((series) => (
                                <div
                                    key={series}
                                    data-series={series}
                                    className={cn(
                                        'min-h-0.5 w-full max-w-4 rounded-t-sm transition-[height] duration-220 ease-standard motion-reduce:transition-none',
                                        SeriesTone[series],
                                    )}
                                    style={{
                                        height: heightOf(
                                            category[series],
                                            model.max,
                                        ),
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    {model.categories.map((category) => (
                        <span
                            key={category.key}
                            className="min-w-0 flex-1 text-center text-xs font-semibold text-muted-foreground tabular-nums"
                        >
                            {category.label}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            aria-hidden="true"
            data-slot="survey-compare-chart"
            data-orientation="rows"
            className="flex flex-col gap-3"
        >
            {model.categories.map((category) => (
                <div key={category.key} className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm break-words text-foreground">
                        {category.label}
                    </span>
                    {(['now', 'before'] as const).map((series) => (
                        <div
                            key={series}
                            className="flex min-w-0 items-center gap-2"
                        >
                            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                    data-series={series}
                                    className={cn(
                                        'h-full rounded-full transition-[width] duration-220 ease-standard motion-reduce:transition-none',
                                        SeriesTone[series],
                                    )}
                                    style={{
                                        width: heightOf(
                                            category[series],
                                            model.max,
                                        ),
                                    }}
                                />
                            </div>
                            <span className="w-14 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
                                {category[series] === null
                                    ? Missing
                                    : model.format(category[series])}
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function CompareTable({
    caption,
    model,
    visible,
}: {
    caption: string;
    model: CompareChartModel;
    visible: boolean;
}) {
    const { t } = useTrans();
    const cell = (value: number | null): string =>
        value === null ? Missing : model.format(value);

    return (
        <div className={visible ? 'w-full min-w-0 overflow-x-auto' : undefined}>
            <table
                data-slot="survey-compare-table"
                className={visible ? 'w-full text-sm' : 'sr-only'}
            >
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-semibold">
                            {model.header}
                        </th>
                        <th scope="col" className="py-2 pr-4 font-semibold">
                            {t('Now')}
                        </th>
                        <th scope="col" className="py-2 font-semibold">
                            {t('Before')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {model.categories.map((category) => (
                        <tr
                            key={category.key}
                            className="border-b last:border-0"
                        >
                            <th
                                scope="row"
                                className="py-2 pr-4 text-left font-medium break-words"
                            >
                                {category.label}
                            </th>
                            <td className="py-2 pr-4 tabular-nums">
                                {cell(category.now)}
                            </td>
                            <td className="py-2 tabular-nums">
                                {cell(category.before)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** The key figure of a scale or an NPS in each survey, above its chart. */
function KeyFigures({ pair }: { pair: SurveyComparisonPair }) {
    const { t } = useTrans();
    const figures =
        pair.kind === 'scale'
            ? [
                  numberOf(pair.current, 'mean'),
                  numberOf(pair.other, 'mean'),
              ].map((value) => (value === null ? Missing : onFive(value)))
            : [numberOf(pair.current, 'nps'), numberOf(pair.other, 'nps')].map(
                  (value) => signed(value) ?? Missing,
              );

    return (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {[t('Now'), t('Before')].map((term, index) => (
                <div key={term} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{term}</dt>
                    <dd className="text-sm font-medium text-foreground tabular-nums">
                        {figures[index]}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** Why a choice has nothing to draw: no option in common, or nobody answered one of the two. */
function NoChoiceChart({ pair }: { pair: SurveyComparisonPair }) {
    const { t } = useTrans();
    const bothAnswered =
        (numberOf(pair.current, 'responses') ?? 0) > 0 &&
        (numberOf(pair.other, 'responses') ?? 0) > 0;

    return (
        <p className="text-sm text-muted-foreground">
            {bothAnswered
                ? t('No option in common.')
                : t('No answers to compare.')}
        </p>
    );
}

function PairRow({
    pair,
    view,
}: {
    pair: SurveyComparisonPair;
    view: CompareView;
}) {
    const labelId = useId();
    const kindLabels = useKindLabels();
    const chartOf = useChartOf();
    const model = chartOf(pair);

    return (
        <li
            aria-labelledby={labelId}
            data-slot="survey-compare-pair"
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-card"
        >
            <div className="flex min-w-0 flex-col gap-2">
                <Badge variant="muted" className="self-start">
                    <span className="truncate">{kindLabels[pair.kind]}</span>
                </Badge>
                <h3
                    id={labelId}
                    className="font-display text-base font-semibold break-words"
                >
                    {pair.label}
                </h3>
            </div>
            {(pair.kind === 'scale' || pair.kind === 'nps') && (
                <KeyFigures pair={pair} />
            )}
            {model === null ? (
                <NoChoiceChart pair={pair} />
            ) : (
                <>
                    <Legend />
                    {view === 'chart' && <CompareChart model={model} />}
                    <CompareTable
                        caption={pair.label}
                        model={model}
                        visible={view === 'table'}
                    />
                </>
            )}
        </li>
    );
}

function LoneQuestions({
    title,
    questions,
}: {
    title: string;
    questions: SurveyComparison['onlyHere'];
}) {
    const headingId = useId();
    const kindLabels = useKindLabels();

    if (questions.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-2">
            <h3
                id={headingId}
                className="text-sm font-semibold break-words text-foreground"
            >
                {title}
            </h3>
            <ul className="flex flex-col gap-1.5">
                {questions.map((question) => (
                    <li
                        key={question.questionId}
                        className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"
                    >
                        <span className="min-w-0 break-words text-foreground">
                            {question.label}
                        </span>
                        <Badge variant="muted">
                            <span className="truncate">
                                {kindLabels[question.kind]}
                            </span>
                        </Badge>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function CompareSkeleton() {
    const { t } = useTrans();

    return (
        <div
            role="status"
            aria-label={t('Loading')}
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))] gap-4"
        >
            {Array.from({ length: SkeletonRows }, (_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card"
                >
                    <Skeleton className="h-2.5 w-1/4 rounded-full" />
                    <Skeleton className="h-3 w-3/5 rounded-full" />
                    <Skeleton className="h-6 w-full rounded-md" />
                </div>
            ))}
        </div>
    );
}

function Notice({ children }: { children: string }) {
    return (
        <p
            role="status"
            data-slot="survey-compare-state"
            className="rounded-lg border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground shadow-card"
        >
            {children}
        </p>
    );
}

function ComparisonBody({
    load,
    view,
    onRetry,
}: {
    load: ComparisonLoad;
    view: CompareView;
    onRetry: () => void;
}) {
    const { t } = useTrans();

    if (load.status === 'idle' || load.status === 'loading') {
        return <CompareSkeleton />;
    }

    if (load.status === 'error') {
        return (
            <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground shadow-card"
            >
                <p>{t('The comparison could not be loaded.')}</p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                >
                    <RotateCcw aria-hidden="true" />
                    <span className="truncate">{t('Retry')}</span>
                </Button>
            </div>
        );
    }

    const { comparison } = load;

    if (comparison === null) {
        return <Notice>{t('Nothing to compare with yet.')}</Notice>;
    }

    if (comparison.belowThreshold) {
        return (
            <Notice>
                {t('The other survey does not have enough answers.')}
            </Notice>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {comparison.pairs.length > 0 && (
                <ul
                    data-slot="survey-compare-pairs"
                    className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))] gap-4"
                >
                    {comparison.pairs.map((pair) => (
                        <PairRow
                            key={pair.questionId}
                            pair={pair}
                            view={view}
                        />
                    ))}
                </ul>
            )}
            <LoneQuestions
                title={t('Only in this survey')}
                questions={comparison.onlyHere}
            />
            <LoneQuestions
                title={t('Only in :title', { title: comparison.other.title })}
                questions={comparison.onlyThere}
            />
        </div>
    );
}

/** The Compare tab: a closed survey of the team to compare with, then the differences per question. */
export function ResultsCompare({
    surveyId,
    comparable,
    defaultLoad,
    onRetryDefault,
}: ResultsCompareProps) {
    const { t } = useTrans();
    const formatDate = useFormatDate();
    const surveys = comparable?.surveys ?? [];
    const fallback = comparable?.defaultId ?? surveys[0]?.id ?? null;
    const [picked, setSelected] = useState<string | null>(fallback);
    const [view, setView] = useState<CompareView>('chart');
    const selected = surveys.some((survey) => survey.id === picked)
        ? picked
        : fallback;
    const isShared =
        defaultLoad !== undefined &&
        selected !== null &&
        selected === comparable?.defaultId;
    const own = useSurveyComparison(surveyId, isShared ? null : selected);

    if (surveys.length === 0 || selected === null) {
        return <Notice>{t('Nothing to compare with yet.')}</Notice>;
    }

    const load = isShared ? defaultLoad : own.load;
    const retry = isShared ? (onRetryDefault ?? own.retry) : own.retry;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="flex w-full max-w-sm min-w-0 flex-col gap-1.5">
                    <Label htmlFor="survey-compare-with">
                        {t('Compare with')}
                    </Label>
                    <Select value={selected} onValueChange={setSelected}>
                        <SelectTrigger
                            id="survey-compare-with"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {surveys.map((survey) => (
                                <SelectItem key={survey.id} value={survey.id}>
                                    {survey.closedAt === null
                                        ? survey.title
                                        : `${survey.title} · ${formatDate(survey.closedAt)}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        setView(view === 'chart' ? 'table' : 'chart')
                    }
                >
                    {view === 'chart' ? (
                        <Table aria-hidden="true" />
                    ) : (
                        <ChartColumn aria-hidden="true" />
                    )}
                    <span className="truncate">
                        {view === 'chart'
                            ? t('View as table')
                            : t('View as chart')}
                    </span>
                </Button>
            </div>
            <ComparisonBody load={load} view={view} onRetry={retry} />
        </div>
    );
}
