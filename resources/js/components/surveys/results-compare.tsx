import { usePage } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';
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

type ChoicePercent = { label: string; percent: number };

type Figures = { now: string; before: string; difference: string | null };

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

/** The difference written out: its sign and a word, never a colour alone. */
function useWrittenDifference() {
    const { t } = useTrans();

    return (value: number | null, amount: (sign: string) => string) => {
        const sign = signed(value, Number.isInteger(value) ? 0 : 1);

        if (value === null || sign === null) {
            return t('No answers to compare.');
        }

        if (value === 0) {
            return t('no change');
        }

        return t(':value, :trend', {
            value: amount(sign),
            trend: value > 0 ? t('higher') : t('lower'),
        });
    };
}

function useFormatDate(): (iso: string) => string {
    const { locale } = usePage().props as { locale?: string };

    return (iso) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(iso),
        );
}

function Figure({ term, value }: { term: string; value: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="text-sm font-medium break-words text-foreground tabular-nums">
                {value}
            </dd>
        </div>
    );
}

function FigureList({ figures }: { figures: Figures }) {
    const { t } = useTrans();

    return (
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(28)),1fr))] gap-3">
            <Figure term={t('Now')} value={figures.now} />
            <Figure term={t('Before')} value={figures.before} />
            {figures.difference !== null && (
                <Figure term={t('Difference')} value={figures.difference} />
            )}
        </dl>
    );
}

function PairFigures({ pair }: { pair: SurveyComparisonPair }) {
    const { t } = useTrans();
    const written = useWrittenDifference();

    switch (pair.kind) {
        case 'scale': {
            const now = numberOf(pair.current, 'mean');
            const before = numberOf(pair.other, 'mean');

            return (
                <FigureList
                    figures={{
                        now: now === null ? Missing : `${now.toFixed(1)} / 5`,
                        before:
                            before === null
                                ? Missing
                                : `${before.toFixed(1)} / 5`,
                        difference: written(
                            typeof pair.delta === 'number' ? pair.delta : null,
                            (sign) => sign,
                        ),
                    }}
                />
            );
        }
        case 'nps': {
            const now = numberOf(pair.current, 'nps');
            const before = numberOf(pair.other, 'nps');

            return (
                <FigureList
                    figures={{
                        now: signed(now) ?? Missing,
                        before: signed(before) ?? Missing,
                        difference: written(
                            typeof pair.delta === 'number' ? pair.delta : null,
                            (sign) => t(':value points', { value: sign }),
                        ),
                    }}
                />
            );
        }
        case 'text':
            return (
                <FigureList
                    figures={{
                        now: t(':count answers', {
                            count: numberOf(pair.current, 'responses') ?? 0,
                        }),
                        before: t(':count answers', {
                            count: numberOf(pair.other, 'responses') ?? 0,
                        }),
                        difference: null,
                    }}
                />
            );
        case 'single':
        case 'multiple':
            return <ChoiceFigures pair={pair} />;
    }
}

/** One line per option both surveys offer, in percentage points. */
function ChoiceFigures({ pair }: { pair: SurveyComparisonPair }) {
    const { t } = useTrans();
    const written = useWrittenDifference();
    const deltas = Array.isArray(pair.delta) ? pair.delta : [];
    const nowByLabel = new Map(
        percentsOf(pair.current).map((option) => [
            option.label,
            option.percent,
        ]),
    );

    if (deltas.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('No answers to compare.')}
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {deltas.map((option) => {
                const now = nowByLabel.get(option.label) ?? 0;

                return (
                    <li
                        key={option.label}
                        className="flex min-w-0 flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
                    >
                        <span className="text-sm break-words text-foreground">
                            {option.label}
                        </span>
                        <FigureList
                            figures={{
                                now: `${now}%`,
                                before: `${now - option.delta}%`,
                                difference: written(option.delta, (sign) =>
                                    t(':value percentage points', {
                                        value: sign,
                                    }),
                                ),
                            }}
                        />
                    </li>
                );
            })}
        </ul>
    );
}

function PairRow({ pair }: { pair: SurveyComparisonPair }) {
    const labelId = useId();
    const kindLabels = useKindLabels();

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
            <PairFigures pair={pair} />
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
    onRetry,
}: {
    load: ComparisonLoad;
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
                        <PairRow key={pair.questionId} pair={pair} />
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
            <div className="flex max-w-sm min-w-0 flex-col gap-1.5">
                <Label htmlFor="survey-compare-with">{t('Compare with')}</Label>
                <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger id="survey-compare-with" className="w-full">
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
            <ComparisonBody load={load} onRetry={retry} />
        </div>
    );
}
