import { CircleCheckIcon, VenetianMaskIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type HealthScore = 1 | 2 | 3 | 4 | 5;

export interface HealthCheckFormStatement {
    id: string;
    label: string;
    text: string;
}

export interface HealthCheckFormProps {
    retroTitle: string;
    statements: HealthCheckFormStatement[];
    answers: Record<string, HealthScore | undefined>;
    onAnswer: (statementId: string, value: HealthScore) => void;
    onSubmit: () => void;
    submitted?: boolean;
    className?: string;
}

const scale: HealthScore[] = [1, 2, 3, 4, 5];

function ScaleQuestion({
    statement,
    value,
    endsId,
    readOnly,
    onAnswer,
}: {
    statement: HealthCheckFormStatement;
    value: HealthScore | undefined;
    endsId: string;
    readOnly: boolean;
    onAnswer: (value: HealthScore) => void;
}) {
    const refs = useRef<Record<number, HTMLButtonElement | null>>({});
    const focusable: HealthScore = value ?? 1;
    const todo = value === undefined && !readOnly;

    function choose(next: HealthScore) {
        refs.current[next]?.focus();
        onAnswer(next);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (readOnly || event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        if (/^[1-5]$/.test(event.key)) {
            event.preventDefault();
            choose(Number(event.key) as HealthScore);

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
        choose((((focusable - 1 + step + 5) % 5) + 1) as HealthScore);
    }

    return (
        <fieldset
            data-slot="health-question"
            data-answered={value !== undefined}
            className="flex min-w-0 flex-col gap-2"
        >
            <legend className="mb-2 flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold">{statement.label}</span>
                <span className="text-body-sm text-muted-foreground">
                    {statement.text}
                </span>
            </legend>
            <div
                role="radiogroup"
                aria-label={statement.label}
                aria-describedby={endsId}
                aria-readonly={readOnly || undefined}
                onKeyDown={handleKeyDown}
                className="grid grid-cols-5 gap-2"
            >
                {scale.map((score) => {
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
                            aria-disabled={readOnly || undefined}
                            tabIndex={score === focusable ? 0 : -1}
                            data-score={score}
                            data-state={checked ? 'on' : 'off'}
                            onClick={() => {
                                if (!readOnly) {
                                    onAnswer(score);
                                }
                            }}
                            className={cn(
                                'h-11 min-w-0 rounded-md border bg-card font-bold transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                todo
                                    ? 'border-dashed border-input'
                                    : 'border-input',
                                !readOnly && 'hover:bg-accent',
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
        </fieldset>
    );
}

export function HealthCheckForm({
    retroTitle,
    statements,
    answers,
    onAnswer,
    onSubmit,
    submitted = false,
    className,
}: HealthCheckFormProps) {
    const { t } = useTrans();
    const endsId = useId();
    const total = statements.length;
    const answered = statements.filter(
        (statement) => answers[statement.id] !== undefined,
    ).length;
    const complete = total > 0 && answered === total;

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
                    <span>{t('1 · Strongly disagree')}</span>
                    <span className="text-right">
                        {t('5 · Strongly agree')}
                    </span>
                </p>
            </div>
            <div className="flex flex-col gap-5 px-5 py-4 @max-card-narrow/card:px-4">
                {total === 0 ? (
                    <p className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground">
                        {t('No statements to answer.')}
                    </p>
                ) : (
                    statements.map((statement) => (
                        <ScaleQuestion
                            key={statement.id}
                            statement={statement}
                            value={answers[statement.id]}
                            endsId={endsId}
                            readOnly={submitted}
                            onAnswer={(value) => onAnswer(statement.id, value)}
                        />
                    ))
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
                                aria-label={t(':answered of :total answered', {
                                    answered,
                                    total,
                                })}
                            />
                            <span
                                data-slot="health-progress"
                                className="text-xs text-muted-foreground"
                            >
                                {t(':answered of :total answered', {
                                    answered,
                                    total,
                                })}
                            </span>
                        </div>
                        <Button
                            type="button"
                            disabled={!complete}
                            onClick={onSubmit}
                        >
                            <span className="truncate">
                                {t('Submit answers')}
                            </span>
                        </Button>
                    </>
                )}
            </div>
        </Card>
    );
}
