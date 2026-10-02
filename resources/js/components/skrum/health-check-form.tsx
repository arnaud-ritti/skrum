import { CircleCheckIcon, VenetianMaskIcon, XIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { isEditableTarget } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** An integer from 1 to the scale; the server stores 1..10. */
export type HealthScore = number;

export const healthCheckScale = 10;

export interface HealthCheckRespondent {
    id: string;
    name: string;
    avatarUrl?: string;
}

/** `key`, `label`, `text`, `count` and `myScore` as in `HealthCheckStatement`. */
export interface HealthCheckFormStatement {
    key: string;
    label: string;
    text: string;
    /** The viewer's own score; `answers` wins when it has the key. */
    myScore?: HealthScore | null;
    /** How many participants answered (`health.answered`). */
    count?: number;
    /** Who answered, resolved from `answeredBy` by the container. */
    answeredBy?: HealthCheckRespondent[];
}

export interface HealthCheckFormProps {
    retroTitle: string;
    statements: HealthCheckFormStatement[];
    /** Scores by statement key. */
    answers?: Record<string, HealthScore | null | undefined>;
    /** Highest score; the server validates 1..10. */
    scale?: number;
    /** Each answer is saved on its own (PUT). */
    onAnswer: (statementKey: string, value: HealthScore) => void;
    /** Removes an answer (DELETE); "Clear" is rendered only when given. */
    onClear?: (statementKey: string) => void;
    /** Backlog: no submit endpoint; the button is rendered only when given. */
    onSubmit?: () => void;
    submitted?: boolean;
    /** The board is closed for editing: every score is disabled. */
    disabled?: boolean;
    className?: string;
}

const visibleRespondents = 8;

function ScaleQuestion({
    statement,
    value,
    scale,
    endsId,
    readOnly,
    disabled,
    onAnswer,
    onClear,
}: {
    statement: HealthCheckFormStatement;
    value: HealthScore | undefined;
    scale: number;
    endsId: string;
    /** Sent: the scores stay focusable and can no longer change. */
    readOnly: boolean;
    disabled: boolean;
    onAnswer: (value: HealthScore) => void;
    onClear?: () => void;
}) {
    const { t } = useTrans();
    const refs = useRef<Record<number, HTMLButtonElement | null>>({});
    const scores = Array.from({ length: scale }, (_, index) => index + 1);
    const focusable: HealthScore = value ?? 1;
    const locked = readOnly || disabled;
    const todo = value === undefined && !locked;
    const respondents = statement.answeredBy ?? [];
    const hiddenRespondents = respondents.length - visibleRespondents;
    const hasProgress = statement.count !== undefined || respondents.length > 0;
    const canClear = value !== undefined && onClear !== undefined && !locked;
    const answeredLabel = t(':count answered', {
        count: statement.count ?? respondents.length,
    });

    function choose(next: HealthScore) {
        refs.current[next]?.focus();
        onAnswer(next);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (
            locked ||
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

        if (isEditableTarget(event.target)) {
            return;
        }

        if (/^[0-9]$/.test(event.key)) {
            const digit = Number(event.key);
            const typed = digit === 0 && scale === 10 ? 10 : digit;

            if (typed >= 1 && typed <= scale) {
                event.preventDefault();
                choose(typed);
            }

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
        choose(((focusable - 1 + step + scale) % scale) + 1);
    }

    return (
        <fieldset
            data-slot="health-question"
            data-statement-key={statement.key}
            data-answered={value !== undefined}
            className="flex min-w-0 flex-col gap-2"
        >
            <legend className="mb-2 flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-start gap-1.5">
                    <span className="min-w-0 text-sm font-bold break-words">
                        {statement.label}
                    </span>
                    {value !== undefined ? (
                        <CircleCheckIcon
                            role="img"
                            aria-label={t('Answered')}
                            className="mt-0.5 size-4 shrink-0 text-skrum-success-text"
                        />
                    ) : null}
                </span>
                <span className="text-body-sm break-words text-muted-foreground">
                    {statement.text}
                </span>
            </legend>
            <div
                role="radiogroup"
                aria-label={statement.text}
                aria-describedby={endsId}
                aria-readonly={readOnly || undefined}
                onKeyDown={handleKeyDown}
                style={{ '--health-scale': scale } as CSSProperties}
                className={cn(
                    'grid gap-2',
                    scale > 5
                        ? 'grid-cols-5 @lg/card:grid-cols-[repeat(var(--health-scale),minmax(0,1fr))]'
                        : 'grid-cols-[repeat(var(--health-scale),minmax(0,1fr))]',
                )}
            >
                {scores.map((score) => {
                    const checked = value === score;

                    return (
                        <button
                            key={score}
                            ref={(node) => {
                                refs.current[score] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={t('Score :score', { score })}
                            aria-disabled={readOnly || undefined}
                            disabled={disabled}
                            tabIndex={score === focusable ? 0 : -1}
                            data-score={score}
                            data-state={checked ? 'on' : 'off'}
                            onClick={() => {
                                if (!locked) {
                                    onAnswer(score);
                                }
                            }}
                            className={cn(
                                'h-11 min-w-0 rounded-md border bg-card font-bold tabular-nums transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
                                todo
                                    ? 'border-dashed border-input'
                                    : 'border-input',
                                !locked && 'hover:bg-accent',
                                readOnly && 'cursor-default',
                                checked &&
                                    'border-primary bg-primary text-primary-foreground hover:bg-primary',
                            )}
                        >
                            {score}
                        </button>
                    );
                })}
            </div>
            {hasProgress || canClear ? (
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div
                        data-slot="health-answered"
                        className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
                    >
                        {respondents.length > 0 ? (
                            <ul
                                aria-label={answeredLabel}
                                className="flex -space-x-1"
                            >
                                {respondents
                                    .slice(0, visibleRespondents)
                                    .map((respondent) => (
                                        <li key={respondent.id}>
                                            <PersonAvatar
                                                size="sm"
                                                name={respondent.name}
                                                src={respondent.avatarUrl}
                                                imgProps={
                                                    respondent.avatarUrl
                                                        ? {
                                                              alt: respondent.name,
                                                          }
                                                        : undefined
                                                }
                                                className="ring-2 ring-card"
                                            />
                                        </li>
                                    ))}
                                {hiddenRespondents > 0 ? (
                                    <li className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1 text-overline font-semibold ring-2 ring-card">
                                        +{hiddenRespondents}
                                    </li>
                                ) : null}
                            </ul>
                        ) : null}
                        {statement.count !== undefined ? (
                            <span
                                className={cn(
                                    statement.count === 0 && 'opacity-70',
                                )}
                            >
                                {answeredLabel}
                            </span>
                        ) : null}
                    </div>
                    {canClear ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full"
                            aria-label={t('Clear: :label', {
                                label: statement.label,
                            })}
                            onClick={() => {
                                refs.current[1]?.focus();
                                onClear();
                            }}
                        >
                            <XIcon aria-hidden />
                            <span className="truncate">{t('Clear')}</span>
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </fieldset>
    );
}

export function HealthCheckForm({
    retroTitle,
    statements,
    answers,
    scale = healthCheckScale,
    onAnswer,
    onClear,
    onSubmit,
    submitted = false,
    disabled = false,
    className,
}: HealthCheckFormProps) {
    const { t } = useTrans();
    const endsId = useId();
    const total = statements.length;
    const valueOf = (
        statement: HealthCheckFormStatement,
    ): HealthScore | undefined => {
        const fromAnswers = answers?.[statement.key];

        if (fromAnswers !== undefined && fromAnswers !== null) {
            return fromAnswers;
        }

        if (answers !== undefined && statement.key in answers) {
            return undefined;
        }

        return statement.myScore ?? undefined;
    };
    const answered = statements.filter(
        (statement) => valueOf(statement) !== undefined,
    ).length;
    const complete = total > 0 && answered === total;
    const progressLabel = t(':answered of :total answered', {
        answered,
        total,
    });

    return (
        <Card
            data-slot="health-check-form"
            data-submitted={submitted}
            className={className}
        >
            <div className="flex flex-col gap-2 px-5 pt-5 @max-card-narrow/card:px-4 @max-card-narrow/card:pt-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 truncate text-ui-lg font-semibold">
                        {t('Health check · :retro', { retro: retroTitle })}
                    </h3>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-skrum-primary-soft px-2 py-0.5 text-xs font-semibold text-skrum-primary-text">
                        <VenetianMaskIcon className="size-3.5" aria-hidden />
                        {t('Anonymous')}
                    </span>
                </div>
                <p className="text-body-sm text-muted-foreground">
                    {t(
                        'Your answers are anonymous. Only the team average is shown.',
                    )}
                </p>
                <p
                    id={endsId}
                    className="flex justify-between gap-3 text-xs text-muted-foreground"
                >
                    <span>{t(':score · Awful', { score: 1 })}</span>
                    <span className="text-right">
                        {t(':score · Great', { score: scale })}
                    </span>
                </p>
            </div>
            <div className="flex flex-col gap-5 px-5 py-4 @max-card-narrow/card:px-4">
                {total === 0 ? (
                    <p className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground">
                        {t('No statements to answer.')}
                    </p>
                ) : (
                    <ol className="flex flex-col gap-5">
                        {statements.map((statement) => (
                            <li key={statement.key} className="min-w-0">
                                <ScaleQuestion
                                    statement={statement}
                                    value={valueOf(statement)}
                                    scale={scale}
                                    endsId={endsId}
                                    readOnly={submitted}
                                    disabled={disabled}
                                    onAnswer={(value) =>
                                        onAnswer(statement.key, value)
                                    }
                                    onClear={
                                        onClear
                                            ? () => onClear(statement.key)
                                            : undefined
                                    }
                                />
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-5 py-4 @max-card-narrow/card:px-4">
                {submitted ? (
                    <p
                        role="status"
                        className="flex items-center gap-2 text-body-sm font-semibold text-skrum-success-text"
                    >
                        <CircleCheckIcon
                            className="size-4 shrink-0"
                            aria-hidden
                        />
                        {t('Answers sent. Thank you.')}
                    </p>
                ) : (
                    <>
                        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
                            <Progress
                                value={answered}
                                max={Math.max(total, 1)}
                                tone="primary"
                                valueLabel=""
                                aria-label={progressLabel}
                            />
                            <span
                                data-slot="health-progress"
                                className="text-xs text-muted-foreground"
                            >
                                {progressLabel}
                            </span>
                        </div>
                        {onSubmit ? (
                            <Button
                                type="button"
                                className="max-w-full"
                                disabled={!complete || disabled}
                                onClick={onSubmit}
                            >
                                <span className="truncate">
                                    {t('Submit answers')}
                                </span>
                            </Button>
                        ) : null}
                    </>
                )}
            </div>
        </Card>
    );
}
