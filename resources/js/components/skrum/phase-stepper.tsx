import {
    ArrowLeft,
    ArrowRight,
    Check,
    CircleCheck,
    Lock,
    RotateCcw,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export const CompletedPhase = 'completed';

export type PhaseStep = {
    id: string;
    label: string;
    skipped?: boolean;
};

export type PhaseStepperProps = {
    phases: PhaseStep[];
    current: string;
    interactive?: boolean;
    compact?: boolean;
    mobile?: boolean;
    leaderName?: string;
    disabled?: boolean;
    reopenTo?: string;
    onPhaseChange?: (phase: string) => void;
    className?: string;
};

type StepState = 'done' | 'current' | 'upcoming';

function StepMarker({ state, number }: { state: StepState; number: number }) {
    return (
        <span
            data-slot="phase-marker"
            aria-hidden
            className={cn(
                'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                state === 'current' && 'bg-primary-foreground/20',
                state === 'done' &&
                    'bg-skrum-success-soft text-skrum-success-text',
                state === 'upcoming' && 'bg-muted text-muted-foreground',
            )}
        >
            {state === 'done' ? (
                <Check className="size-3" aria-hidden />
            ) : (
                number
            )}
        </span>
    );
}

function ActionButton({
    label,
    icon,
    iconAfter,
    compact,
    variant,
    disabled,
    onClick,
}: {
    label: string;
    icon: ReactNode;
    iconAfter?: boolean;
    compact?: boolean;
    variant: 'default' | 'outline';
    disabled?: boolean;
    onClick: () => void;
}) {
    const button = (
        <Button
            type="button"
            size={compact ? 'icon-sm' : 'sm'}
            variant={variant}
            disabled={disabled}
            onClick={onClick}
            className="shrink-0"
        >
            {!iconAfter && icon}
            <span className={cn(compact ? 'sr-only' : 'truncate')}>
                {label}
            </span>
            {iconAfter && icon}
        </Button>
    );

    if (!compact) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function PhaseStepper({
    phases,
    current,
    interactive = false,
    compact = false,
    mobile = false,
    leaderName,
    disabled = false,
    reopenTo,
    onPhaseChange,
    className,
}: PhaseStepperProps) {
    const { t } = useTrans();
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const isEnded = current === CompletedPhase;
    const total = phases.length;
    const foundIndex = phases.findIndex((phase) => phase.id === current);
    const currentIndex = isEnded ? total : foundIndex;
    const currentStep = phases[foundIndex];
    const canChange = interactive && onPhaseChange !== undefined;

    const previousStep = isEnded ? undefined : phases[currentIndex - 1];
    const nextStep = isEnded ? undefined : phases[currentIndex + 1];
    const reopenTarget = reopenTo ?? phases[total - 1]?.id;
    const progressValue = isEnded ? total : Math.max(currentIndex + 1, 0);

    const stateOf = (index: number): StepState => {
        if (index < currentIndex) {
            return 'done';
        }

        return index === currentIndex ? 'current' : 'upcoming';
    };

    const isReachable = (index: number): boolean =>
        canChange && !disabled && Math.abs(index - currentIndex) === 1;

    const announcement = isEnded
        ? t('Ended')
        : t('Phase :label', { label: currentStep?.label ?? '' });

    const rovingId = focusedId ?? currentStep?.id ?? phases[0]?.id;

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
            return;
        }

        event.preventDefault();
        const targetIndex = event.key === 'ArrowRight' ? index + 1 : index - 1;
        const target = buttonRefs.current[targetIndex];

        if (!target) {
            return;
        }

        setFocusedId(phases[targetIndex].id);
        target.focus();
    }

    const actions = canChange && (
        <>
            {previousStep && (
                <ActionButton
                    label={t('Previous')}
                    icon={<ArrowLeft aria-hidden />}
                    compact={compact}
                    variant="outline"
                    disabled={disabled}
                    onClick={() => onPhaseChange(previousStep.id)}
                />
            )}
            {nextStep && (
                <ActionButton
                    label={t('Next')}
                    icon={<ArrowRight aria-hidden />}
                    iconAfter
                    compact={compact}
                    variant="default"
                    disabled={disabled}
                    onClick={() => onPhaseChange(nextStep.id)}
                />
            )}
            {!isEnded && !nextStep && currentStep && (
                <ActionButton
                    label={t('Complete')}
                    icon={<CircleCheck aria-hidden />}
                    compact={compact}
                    variant="default"
                    disabled={disabled}
                    onClick={() => onPhaseChange(CompletedPhase)}
                />
            )}
            {isEnded && reopenTarget && (
                <ActionButton
                    label={t('Reopen')}
                    icon={<RotateCcw aria-hidden />}
                    compact={compact}
                    variant="outline"
                    disabled={disabled}
                    onClick={() => onPhaseChange(reopenTarget)}
                />
            )}
        </>
    );

    const leaderNote = !interactive && leaderName && (
        <span
            data-slot="phase-leader"
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
        >
            <Lock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
                {t(':name leads the phases', { name: leaderName })}
            </span>
        </span>
    );

    const endedBadge = isEnded && (
        <span
            data-slot="phase-ended"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-skrum-success-soft px-3 py-1 text-sm font-semibold text-skrum-success-text"
        >
            <CircleCheck className="size-4" aria-hidden />
            <span className="truncate">{t('Ended')}</span>
        </span>
    );

    const live = (
        <p className="sr-only" aria-live="polite" role="status">
            {announcement}
        </p>
    );

    if (mobile) {
        return (
            <div
                data-slot="phase-stepper"
                data-mode="mobile"
                className={cn('flex min-w-0 flex-col gap-2', className)}
            >
                <nav
                    aria-label={t('Retro phases')}
                    className="flex min-w-0 items-center gap-2"
                >
                    {isEnded ? (
                        endedBadge
                    ) : (
                        <>
                            <span
                                data-slot="phase-count"
                                className="inline-flex shrink-0 items-center rounded-full bg-skrum-primary-soft px-2.5 py-0.5 text-sm font-semibold text-skrum-primary-text tabular-nums"
                            >
                                {t('Phase :current/:total', {
                                    current: progressValue,
                                    total,
                                })}
                            </span>
                            <span
                                aria-current="step"
                                className="min-w-0 grow truncate text-sm font-semibold text-foreground"
                            >
                                {currentStep?.label}
                            </span>
                        </>
                    )}
                    {isEnded && <span className="grow" />}
                    {actions}
                </nav>
                <Progress
                    value={progressValue}
                    max={Math.max(total, 1)}
                    valueLabel=""
                    aria-label={t('Retro phases')}
                    className="h-1.5"
                />
                {leaderNote}
                {live}
            </div>
        );
    }

    return (
        <div
            data-slot="phase-stepper"
            data-mode={compact ? 'compact' : 'full'}
            className={cn('flex min-w-0 items-center gap-3', className)}
        >
            <nav
                aria-label={t('Retro phases')}
                className="relative min-w-0 overflow-x-auto"
            >
                <ol
                    data-slot="phase-rail"
                    className="flex w-max items-center gap-1 rounded-full border border-border bg-card p-1 shadow-card"
                >
                    {phases.map((phase, index) => {
                        const state = stateOf(index);
                        const isCurrent = state === 'current';
                        const reachable = isReachable(index);
                        const showLabel = !compact || isCurrent;
                        const suffix = phase.skipped
                            ? t('skipped')
                            : state === 'done'
                              ? t('done')
                              : null;
                        const content = (
                            <>
                                <StepMarker state={state} number={index + 1} />
                                <span
                                    className={cn(
                                        showLabel ? 'truncate' : 'sr-only',
                                        phase.skipped &&
                                            !isCurrent &&
                                            'text-muted-foreground line-through',
                                    )}
                                >
                                    {phase.label}
                                </span>
                                {suffix && (
                                    <span className="sr-only">{`, ${suffix}`}</span>
                                )}
                            </>
                        );
                        const stepClass = cn(
                            'inline-flex h-7 max-w-40 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-sm font-medium transition-colors duration-140 ease-standard motion-reduce:transition-none',
                            showLabel && 'pr-2.5',
                            isCurrent
                                ? 'bg-primary text-primary-foreground'
                                : 'text-foreground',
                        );

                        return (
                            <Fragment key={phase.id}>
                                {index > 0 && (
                                    <li
                                        aria-hidden
                                        data-slot="phase-link"
                                        className={cn(
                                            'h-px w-3 shrink-0',
                                            index <= currentIndex
                                                ? 'bg-skrum-success'
                                                : 'bg-border',
                                        )}
                                    />
                                )}
                                <li data-slot="phase-step" data-state={state}>
                                    {canChange ? (
                                        <button
                                            type="button"
                                            ref={(node) => {
                                                buttonRefs.current[index] =
                                                    node;
                                            }}
                                            tabIndex={
                                                phase.id === rovingId ? 0 : -1
                                            }
                                            aria-current={
                                                isCurrent ? 'step' : undefined
                                            }
                                            aria-disabled={
                                                !isCurrent && !reachable
                                                    ? true
                                                    : undefined
                                            }
                                            onFocus={() =>
                                                setFocusedId(phase.id)
                                            }
                                            onKeyDown={(event) =>
                                                handleKeyDown(event, index)
                                            }
                                            onClick={() => {
                                                if (reachable) {
                                                    onPhaseChange(phase.id);
                                                }
                                            }}
                                            className={cn(
                                                stepClass,
                                                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                                reachable
                                                    ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                                                    : 'cursor-default',
                                            )}
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <span
                                            aria-current={
                                                isCurrent ? 'step' : undefined
                                            }
                                            className={stepClass}
                                        >
                                            {content}
                                        </span>
                                    )}
                                </li>
                            </Fragment>
                        );
                    })}
                </ol>
            </nav>
            {endedBadge}
            {actions}
            {leaderNote}
            {live}
        </div>
    );
}
