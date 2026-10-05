import {
    ArrowLeft,
    ArrowRight,
    Check,
    CircleCheck,
    Lock,
    RotateCcw,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
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
    /**
     * Without `compact` or `mobile` the stepper follows two widths. Its own:
     * markers with the current label from 18rem, "Phase n/m" with a progress
     * bar below. That of the container named `session` (the session header):
     * every label and the names of the actions from 105rem (`session-rail`),
     * where they fit beside the title, the timer and the people present;
     * without such a container around it the labels stay hidden. `compact`
     * never shows the full rail. `mobile` is the rail of a phone at any
     * width: a marker per step and the label of the current one, read only,
     * the moves being left to the screen (its menu). Once completed the rail
     * is its ticked markers beside the badge, and "Reopen" is the only action.
     */
    compact?: boolean;
    mobile?: boolean;
    /** Every phase shows its label wherever the rail is drawn. */
    labelled?: boolean;
    /**
     * `steps`: a read-only rail of named steps (the onboarding header): every
     * label is shown beside its marker wherever the rail is drawn, and the
     * list, the count and the announcement speak of steps, not phases.
     */
    variant?: 'phases' | 'steps';
    leaderName?: string;
    disabled?: boolean;
    reopenTo?: string;
    /** Text of the badge shown once the retro is completed. */
    endedLabel?: string;
    onPhaseChange?: (phase: string) => void;
    className?: string;
};

type StepState = 'done' | 'current' | 'upcoming';

type StepperMode = 'auto' | 'compact' | 'mobile';

type LabelVisibility = 'always' | 'never' | 'full';

function StepMarker({
    state,
    number,
    className,
}: {
    state: StepState;
    number: number;
    className: string;
}) {
    return (
        <span
            data-slot="phase-marker"
            aria-hidden
            className={cn(
                'size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                state === 'current' && 'bg-primary-foreground/20',
                state === 'done' &&
                    'bg-skrum-success-soft text-skrum-success-text',
                state === 'upcoming' && 'bg-muted text-muted-foreground',
                className,
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

/**
 * A label that stays in the accessibility tree when it is not shown: read
 * only by assistive tech until the session header is wide enough for the full
 * rail.
 */
function StepLabel({
    visibility,
    className,
    children,
}: {
    visibility: LabelVisibility;
    className?: string;
    children: ReactNode;
}) {
    if (visibility === 'always') {
        return <span className={cn('truncate', className)}>{children}</span>;
    }

    return (
        <span
            className={cn(
                'sr-only',
                visibility === 'full' &&
                    '@session-rail/session:not-sr-only @session-rail/session:flex @session-rail/session:min-w-0',
            )}
        >
            <span
                className={cn('block max-w-full min-w-0 truncate', className)}
            >
                {children}
            </span>
        </span>
    );
}

function ActionButton({
    label,
    icon,
    iconAfter,
    labelVisibility,
    variant,
    unavailable,
    slot,
    onClick,
}: {
    label: string;
    icon: ReactNode;
    iconAfter?: boolean;
    labelVisibility: LabelVisibility;
    variant: 'default' | 'outline';
    unavailable: boolean;
    slot: string;
    onClick: () => void;
}) {
    const button = (
        <Button
            type="button"
            size={labelVisibility === 'never' ? 'icon-sm' : 'sm'}
            variant={variant}
            data-slot={slot}
            aria-disabled={unavailable || undefined}
            onClick={() => {
                if (!unavailable) {
                    onClick();
                }
            }}
            className={cn(
                'max-w-40 min-w-0 shrink-0',
                labelVisibility === 'full' &&
                    'w-8 px-0 has-[>svg]:px-0 @session-rail/session:w-auto @session-rail/session:px-3 @session-rail/session:has-[>svg]:px-2.5',
                unavailable && 'cursor-not-allowed opacity-50',
            )}
        >
            {!iconAfter && icon}
            <StepLabel visibility={labelVisibility}>{label}</StepLabel>
            {iconAfter && icon}
        </Button>
    );

    if (labelVisibility === 'always') {
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
    labelled = false,
    variant = 'phases',
    leaderName,
    disabled = false,
    reopenTo,
    endedLabel,
    onPhaseChange,
    className,
}: PhaseStepperProps) {
    const { t } = useTrans();
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLLIElement>(null);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const mode: StepperMode = mobile ? 'mobile' : compact ? 'compact' : 'auto';
    const isMobile = mode === 'mobile';
    const isEnded = current === CompletedPhase;
    // Once ended no step is the current one: every label at once does not
    // fit a header, so the rail keeps its ticked markers.
    const isSteps = variant === 'steps';
    const otherLabels: LabelVisibility =
        mode === 'auto' && !isEnded
            ? isSteps || labelled
                ? 'always'
                : 'full'
            : 'never';
    const actionLabels: LabelVisibility = compact ? 'never' : 'full';

    const total = phases.length;
    const foundIndex = phases.findIndex((phase) => phase.id === current);
    const currentIndex = isEnded ? total : foundIndex;
    const currentStep = phases[foundIndex];
    const isKnown = isEnded || currentStep !== undefined;
    const canChange =
        interactive && onPhaseChange !== undefined && !isMobile && isKnown;

    const previousStep = isEnded ? undefined : phases[currentIndex - 1];
    const nextStep = isEnded ? undefined : phases[currentIndex + 1];
    const reopenTarget = reopenTo ?? phases[total - 1]?.id;
    const progressValue = isEnded ? total : Math.max(currentIndex + 1, 0);
    const ended = endedLabel ?? t('Completed');

    useEffect(() => {
        const scroller = scrollerRef.current;
        const step = currentRef.current;

        if (!scroller || !step || typeof scroller.scrollTo !== 'function') {
            return;
        }

        scroller.scrollTo({
            left:
                step.offsetLeft - (scroller.clientWidth - step.offsetWidth) / 2,
        });
    }, [current, total]);

    const stateOf = (index: number): StepState => {
        if (index < currentIndex) {
            return 'done';
        }

        return index === currentIndex ? 'current' : 'upcoming';
    };

    const isReachable = (index: number): boolean =>
        canChange && !disabled && Math.abs(index - currentIndex) === 1;

    const currentLabel = currentStep?.label ?? '';
    const announcement = isEnded
        ? ended
        : isSteps
          ? t('Step :label', { label: currentLabel })
          : t('Phase :label', { label: currentLabel });

    const rovingId = phases.some((phase) => phase.id === focusedId)
        ? focusedId
        : (currentStep?.id ?? phases[0]?.id);
    const countLabel = isSteps
        ? t('Step :current/:total', { current: progressValue, total })
        : t('Phase :current/:total', { current: progressValue, total });

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
            return;
        }

        // An arrow with a modifier is a shortcut of the page (mod+ArrowRight
        // is the next phase), not a move between the markers.
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        event.preventDefault();
        const targetIndex = event.key === 'ArrowRight' ? index + 1 : index - 1;
        const target = buttonRefs.current[targetIndex];

        // A step hidden by a narrow container takes no focus, so its onFocus
        // never moves the roving tab stop away from the shown one.
        target?.focus();
    }

    // One button per slot, mounted for as long as the stepper is interactive:
    // the label, icon and handler change, the element (and its focus) stays.
    const forward = isEnded
        ? {
              label: t('Reopen'),
              icon: <RotateCcw aria-hidden />,
              iconAfter: false,
              variant: 'outline' as const,
              target: reopenTarget,
          }
        : nextStep
          ? {
                label: compact ? t('Next phase') : t('Next'),
                icon: <ArrowRight aria-hidden />,
                iconAfter: true,
                variant: 'default' as const,
                target: nextStep.id,
            }
          : {
                label: t('Complete'),
                icon: <CircleCheck aria-hidden />,
                iconAfter: false,
                variant: 'default' as const,
                target: currentStep ? CompletedPhase : undefined,
            };

    const actions = canChange && (
        <>
            {!isEnded && (
                <ActionButton
                    slot="phase-previous"
                    label={t('Previous')}
                    icon={<ArrowLeft aria-hidden />}
                    labelVisibility={actionLabels}
                    variant="outline"
                    unavailable={disabled || previousStep === undefined}
                    onClick={() => {
                        if (previousStep) {
                            onPhaseChange(previousStep.id);
                        }
                    }}
                />
            )}
            <ActionButton
                slot="phase-forward"
                label={forward.label}
                icon={forward.icon}
                iconAfter={forward.iconAfter}
                labelVisibility={compact ? 'always' : actionLabels}
                variant={forward.variant}
                unavailable={disabled || forward.target === undefined}
                onClick={() => {
                    if (forward.target !== undefined) {
                        onPhaseChange(forward.target);
                    }
                }}
            />
        </>
    );

    return (
        <div
            data-slot="phase-stepper"
            data-mode={mode}
            className={cn(
                '@container/phases flex min-w-0 flex-col gap-2',
                className,
            )}
        >
            <div
                className={cn(
                    'flex min-w-0 flex-wrap items-center gap-2',
                    !isMobile && '@2xs/phases:flex-nowrap @2xs/phases:gap-3',
                )}
            >
                {!isEnded && !isMobile && isKnown && (
                    <span
                        data-slot="phase-count"
                        className="inline-flex shrink-0 items-center rounded-full bg-skrum-primary-soft px-2.5 py-0.5 text-sm font-semibold text-skrum-primary-text tabular-nums @2xs/phases:hidden"
                    >
                        {countLabel}
                    </span>
                )}
                {isEnded && (
                    <span
                        data-slot="phase-ended"
                        aria-current="step"
                        className="inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-skrum-success-soft px-3 py-1 text-sm font-semibold text-skrum-success-text"
                    >
                        <CircleCheck className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{ended}</span>
                    </span>
                )}
                <div
                    ref={scrollerRef}
                    data-slot="phase-scroller"
                    className={cn(
                        'relative min-w-0 grow basis-0',
                        isMobile
                            ? 'shrink grow-0 basis-auto overflow-x-auto'
                            : '@2xs/phases:shrink @2xs/phases:grow-0 @2xs/phases:basis-auto @2xs/phases:overflow-x-auto',
                        !isMobile && isEnded && '@2xs/phases:order-first',
                    )}
                >
                    <ol
                        aria-label={isSteps ? t('Steps') : t('Phases')}
                        data-slot="phase-rail"
                        className={cn(
                            'flex min-w-0 items-center',
                            isMobile
                                ? 'w-max gap-0.5 rounded-full border border-border bg-card p-1'
                                : '@2xs/phases:w-max @2xs/phases:gap-1 @2xs/phases:rounded-full @2xs/phases:border @2xs/phases:border-border @2xs/phases:bg-card @2xs/phases:p-1 @2xs/phases:shadow-card',
                        )}
                    >
                        {phases.map((phase, index) => {
                            const state = stateOf(index);
                            const isCurrent = state === 'current';

                            const reachable = isReachable(index);
                            const suffix = phase.skipped
                                ? t('skipped')
                                : state === 'done'
                                  ? t('done')
                                  : null;
                            const content = (
                                <>
                                    <StepMarker
                                        state={state}
                                        number={index + 1}
                                        className={
                                            isCurrent && !isMobile
                                                ? 'hidden @2xs/phases:inline-flex'
                                                : 'inline-flex'
                                        }
                                    />
                                    <StepLabel
                                        visibility={
                                            isCurrent ? 'always' : otherLabels
                                        }
                                        className={cn(
                                            phase.skipped &&
                                                !isCurrent &&
                                                'text-muted-foreground line-through',
                                        )}
                                    >
                                        {phase.label}
                                    </StepLabel>
                                    {suffix && (
                                        <span className="sr-only">{`, ${suffix}`}</span>
                                    )}
                                </>
                            );
                            const stepClass = cn(
                                'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full text-sm transition-colors duration-140 ease-standard motion-reduce:transition-none',
                                isCurrent
                                    ? 'max-w-full font-semibold text-foreground'
                                    : 'max-w-40 shrink-0 px-1.5 font-medium text-foreground',
                                isCurrent &&
                                    (isMobile
                                        ? 'max-w-40 bg-primary pr-2.5 pl-1.5 font-medium text-primary-foreground'
                                        : '@2xs/phases:max-w-40 @2xs/phases:bg-primary @2xs/phases:pr-2.5 @2xs/phases:pl-1.5 @2xs/phases:font-medium @2xs/phases:text-primary-foreground'),
                                // A phone holds seven markers and a label in
                                // its width only with tighter steps.
                                !isCurrent && isMobile && 'px-1',
                                !isCurrent &&
                                    otherLabels === 'full' &&
                                    '@session-rail/session:pr-2.5',
                            );

                            return (
                                <Fragment key={phase.id}>
                                    {index > 0 && (
                                        <li
                                            aria-hidden
                                            data-slot="phase-link"
                                            className={cn(
                                                'h-px shrink-0',
                                                isMobile
                                                    ? 'block w-2'
                                                    : 'hidden w-3 @2xs/phases:block',
                                                index <= currentIndex
                                                    ? 'bg-skrum-success'
                                                    : 'bg-border',
                                            )}
                                        />
                                    )}
                                    <li
                                        ref={isCurrent ? currentRef : undefined}
                                        data-slot="phase-step"
                                        data-state={state}
                                        className={cn(
                                            isCurrent
                                                ? 'flex min-w-0'
                                                : isMobile
                                                  ? 'flex'
                                                  : 'hidden @2xs/phases:flex',
                                        )}
                                    >
                                        {canChange ? (
                                            <button
                                                type="button"
                                                ref={(node) => {
                                                    buttonRefs.current[index] =
                                                        node;
                                                }}
                                                tabIndex={
                                                    phase.id === rovingId
                                                        ? 0
                                                        : -1
                                                }
                                                aria-current={
                                                    isCurrent
                                                        ? 'step'
                                                        : undefined
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
                                                    isCurrent
                                                        ? 'step'
                                                        : undefined
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
                </div>
                {actions}
                {!interactive && leaderName && (
                    <span
                        data-slot="phase-leader"
                        className={cn(
                            'inline-flex min-w-0 basis-full items-center gap-1.5 text-sm text-muted-foreground',
                            !isMobile && '@2xs/phases:basis-auto',
                        )}
                    >
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                            {t(':name leads the phases', { name: leaderName })}
                        </span>
                    </span>
                )}
            </div>
            {!isMobile && (
                <div data-slot="phase-progress" className="@2xs/phases:hidden">
                    <Progress
                        value={progressValue}
                        max={Math.max(total, 1)}
                        valueLabel=""
                        aria-valuetext={isEnded ? ended : countLabel}
                        aria-label={isSteps ? t('Steps') : t('Retro phases')}
                        className="h-1.5"
                    />
                </div>
            )}
            <p className="sr-only" aria-live="polite" role="status">
                {announcement}
            </p>
        </div>
    );
}
