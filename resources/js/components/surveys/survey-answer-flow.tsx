import {
    ArrowLeft,
    ArrowRight,
    ChartBar,
    CircleDot,
    ListChecks,
    Lock,
    SlidersHorizontal,
    Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { isEditableTarget } from '@/hooks/use-shortcut';
import { useSingleKeyShortcuts } from '@/hooks/use-single-key-shortcuts';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError } from '@/lib/retro/api';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import {
    digitRange,
    digitValue,
    firstUnanswered,
    stepOf,
} from '@/lib/surveys/answer-flow';
import { toQuestionProps } from '@/lib/surveys/question-adapter';
import type { SurveyKind, SurveyQuestionPayload } from '@/lib/surveys/types';
import { cn } from '@/lib/utils';
import { SurveyProgress } from './survey-progress';
import { useSurveyAnswers } from './use-survey-answers';
import type { SurveyAnswers, SurveyAnswerSaver } from './use-survey-answers';

const overlaySelector =
    '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

/** A radio or a checkbox, native or drawn as a button. */
function isChoiceTarget(target: EventTarget | null): boolean {
    return (
        target instanceof Element &&
        target.closest('[role="checkbox"], [role="radio"]') !== null
    );
}

/** A radio or a checkbox is not a text field: the digits and Enter still work there. */
function isTextField(target: EventTarget | null): boolean {
    if (
        target instanceof HTMLInputElement &&
        (target.type === 'radio' || target.type === 'checkbox')
    ) {
        return false;
    }

    return isEditableTarget(target);
}

/** Enter on a button or a link is the button's or the link's own. */
function isActionTarget(target: EventTarget | null): boolean {
    return (
        !isChoiceTarget(target) &&
        target instanceof Element &&
        target.closest('button, a[href], [role="button"]') !== null
    );
}

/** The first thing a person can answer with, to take the focus after an error. */
export function focusControl(container: HTMLElement | null): void {
    container
        ?.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), button[role="checkbox"]:not(:disabled)',
        )
        ?.focus();
}

/** The error a refused submission gives when it names no question. */
export function submissionError(error: unknown): string | null {
    if (!(error instanceof RetroRequestError)) {
        return null;
    }

    return Object.values(error.errors)[0]?.[0] ?? error.message;
}

const kindIcons: Record<SurveyKind, LucideIcon> = {
    scale: SlidersHorizontal,
    nps: ChartBar,
    single: CircleDot,
    multiple: ListChecks,
    text: Type,
};

function KindBadge({ kind }: { kind: SurveyKind }) {
    const { t } = useTrans();
    const labels: Record<SurveyKind, string> = {
        scale: t('Scale 1 to 5'),
        nps: t('NPS'),
        single: t('Single choice'),
        multiple: t('Multiple choice'),
        text: t('Free text'),
    };

    return (
        <Badge variant="soft" icon={kindIcons[kind]} className="self-start">
            {labels[kind]}
        </Badge>
    );
}

/** "Not saved — Retry", under a question whose answer did not reach the server. */
export function SurveyNotSaved({ onRetry }: { onRetry: () => void }) {
    const { t } = useTrans();

    return (
        <p
            role="alert"
            className="flex items-center gap-1 text-xs text-skrum-destructive-text"
        >
            <span>{t('Not saved')}</span>
            <span aria-hidden="true">—</span>
            <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={onRetry}
            >
                {t('Retry')}
            </Button>
        </p>
    );
}

/** The line under the card: nobody can link an answer to its author. */
export function SurveyPrivacyLine() {
    const { t } = useTrans();

    return (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Lock aria-hidden className="size-4 shrink-0" />
            <span>
                {t(
                    'Neither the facilitator nor the team can link this answer to you.',
                )}
            </span>
        </p>
    );
}

/** The question's control, its comment and its save state, wired to the answers. */
export function AnswerControl({
    question,
    answers,
    invalid,
    labelledBy,
    disabled = false,
    className,
}: {
    question: SurveyQuestionPayload;
    answers: SurveyAnswers;
    invalid: boolean;
    labelledBy: string;
    /** An observer reads the question and gives no answer. */
    disabled?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const draft = answers.draft(question);
    const props = toQuestionProps(question, { mode: 'answer' });
    const scaleLabels: [string, string] | undefined =
        question.kind === 'nps'
            ? [`0 · ${t('Not at all likely')}`, `10 · ${t('Extremely likely')}`]
            : props.scaleLabels;
    const takesComment =
        question.allowsComment &&
        (question.kind === 'scale' || question.kind === 'nps');

    return (
        <>
            <SurveyQuestion
                {...props}
                scaleLabels={scaleLabels}
                chrome="none"
                labelledBy={labelledBy}
                invalid={invalid}
                disabled={disabled}
                value={draft.value}
                comment={draft.comment}
                onChange={(value) => answers.change(question, value)}
                onCommentChange={
                    takesComment
                        ? (comment) => answers.changeComment(question, comment)
                        : undefined
                }
                className={className}
            />
            {answers.hasFailed(question.id) && (
                <SurveyNotSaved
                    onRetry={() => void answers.retry(question.id)}
                />
            )}
        </>
    );
}

function KeyHint({
    question,
    canScore,
}: {
    question: SurveyQuestionPayload;
    canScore: boolean;
}) {
    const { t } = useTrans();
    const range = canScore ? digitRange(question) : null;

    return (
        <span
            data-slot="survey-key-hint"
            className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground"
        >
            {range && (
                <>
                    <Kbd>{range[0]}</Kbd>–<Kbd>{range[1]}</Kbd>
                    <span>{t('to score')}</span>
                    <span aria-hidden="true">·</span>
                </>
            )}
            <Kbd aria-hidden>↵</Kbd>
            <span className="sr-only">{t('Enter')}</span>
            <span>{t('to go on')}</span>
        </span>
    );
}

type SurveyAnswerFlowProps = {
    questions: SurveyQuestionPayload[];
    onSave: SurveyAnswerSaver;
    /** Sends the response; rejects with the server's refusal. In preview: closes the dialog. */
    onFinish: () => Promise<void> | void;
    /** The builder's preview: nothing is sent, the answers stay on screen. */
    preview?: boolean;
    /** Where to start; by default the first question without an answer. */
    initialStep?: number;
    /** An observer of the team: the questions are shown, nothing is answered nor sent. */
    readOnly?: boolean;
};

/** One question at a time (ScreenSurvey frame b; MobileRituals on a phone). */
export function SurveyAnswerFlow({
    questions,
    onSave,
    onFinish,
    preview = false,
    initialStep,
    readOnly = false,
}: SurveyAnswerFlowProps) {
    const { t } = useTrans();
    const isPhone = useIsMobile();
    const [shortcutsOn] = useSingleKeyShortcuts();
    const answers = useSurveyAnswers(questions, onSave, preview);
    const [step, setStep] = useState(() =>
        Math.min(
            initialStep ?? (preview ? 0 : firstUnanswered(questions)),
            Math.max(questions.length - 1, 0),
        ),
    );
    const [invalidId, setInvalidId] = useState<string | null>(null);
    const [finishError, setFinishError] = useState<string | null>(null);
    const [finishing, setFinishing] = useState(false);
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const card = useRef<HTMLElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const hasMoved = useRef(false);
    const question = questions[step];
    const isLast = step >= questions.length - 1;

    useEffect(() => {
        if (!hasMoved.current) {
            return;
        }

        heading.current?.focus();
    }, [step]);

    const moveTo = (next: number): void => {
        hasMoved.current = true;
        setInvalidId(null);
        setFinishError(null);
        setStep(next);
    };

    const finish = async (): Promise<void> => {
        if (finishing) {
            return;
        }

        setFinishing(true);
        setFinishError(null);

        try {
            const unsaved = await answers.flushAll();

            if (unsaved.length > 0) {
                const target = questions.findIndex(
                    (known) => known.id === unsaved[0],
                );

                if (target >= 0 && target !== step) {
                    moveTo(target);
                }

                setFinishError(t('Your answers could not be sent. Try again.'));

                return;
            }

            await onFinish();
        } catch (error) {
            const target =
                error instanceof RetroRequestError && error.status === 422
                    ? stepOf(error.errors, questions)
                    : null;

            if (target !== null) {
                moveTo(target);
                setInvalidId(questions[target].id);

                return;
            }

            setFinishError(
                submissionError(error) ??
                    t('Your answers could not be sent. Try again.'),
            );
        } finally {
            setFinishing(false);
        }
    };

    const goNext = (): void => {
        if (question === undefined) {
            return;
        }

        if (readOnly) {
            moveTo(Math.min(step + 1, questions.length - 1));

            return;
        }

        if (question.isRequired && !answers.isAnswered(question)) {
            setInvalidId(question.id);
            focusControl(card.current);

            return;
        }

        if (isLast) {
            void finish();

            return;
        }

        void answers.flush(question.id);
        moveTo(step + 1);
    };

    const goPrevious = (): void => {
        if (question === undefined || step === 0) {
            return;
        }

        void answers.flush(question.id);
        moveTo(step - 1);
    };

    const keys = useRef({ goNext, question, answers, readOnly });

    keys.current = { goNext, question, answers, readOnly };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            const target = event.target;

            /* A drawn checkbox or radio keeps Enter from its own click by preventing it. */
            const isEnterOnChoice =
                event.key === 'Enter' && isChoiceTarget(target);

            if (
                (event.defaultPrevented && !isEnterOnChoice) ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                isTextField(target) ||
                !singleKeyShortcutsEnabled()
            ) {
                return;
            }

            const overlay =
                target instanceof Element
                    ? target.closest(overlaySelector)
                    : null;

            if (overlay !== null && !overlay.contains(root.current)) {
                return;
            }

            const {
                goNext: next,
                question: current,
                answers: held,
                readOnly: reading,
            } = keys.current;

            if (current === undefined) {
                return;
            }

            if (event.key === 'Enter') {
                if (isActionTarget(target)) {
                    return;
                }

                event.preventDefault();
                next();

                return;
            }

            const value = digitValue(event.key, current);

            if (value === null || reading) {
                return;
            }

            event.preventDefault();
            held.change(current, value);
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    if (question === undefined) {
        return null;
    }

    const isInvalid =
        invalidId === question.id && !answers.isAnswered(question);
    const nextLabel = isLast ? t('Finish') : t('Next');

    const previousButton = isPhone ? (
        <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t('Previous')}
            disabled={step === 0}
            onClick={goPrevious}
            className="shrink-0"
        >
            <ArrowLeft aria-hidden />
        </Button>
    ) : (
        <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={goPrevious}
        >
            <ArrowLeft aria-hidden />
            {t('Previous')}
        </Button>
    );

    const nextButton =
        readOnly && isLast ? null : (
            <Button
                type="button"
                size="lg"
                aria-busy={finishing || undefined}
                onClick={goNext}
                className={cn(isPhone && 'flex-1')}
            >
                {finishing && <Spinner aria-hidden />}
                {nextLabel}
                {!isLast && <ArrowRight aria-hidden />}
            </Button>
        );

    return (
        <div ref={root} className="flex h-full min-h-0 flex-col">
            <div
                data-slot="survey-flow-scroll"
                className="min-h-0 flex-1 overflow-y-auto"
            >
                <div
                    className={cn(
                        'mx-auto flex w-full max-w-190 flex-col gap-4 px-4 py-6',
                        !isPhone && 'min-h-full justify-center gap-6 md:py-10',
                    )}
                >
                    <SurveyProgress index={step} count={questions.length} />
                    <section
                        ref={card}
                        aria-labelledby={headingId}
                        data-test="survey-step"
                        data-step={step}
                        data-layout={isPhone ? 'phone' : 'card'}
                        className={cn(
                            'flex min-w-0 flex-col gap-5',
                            !isPhone &&
                                'gap-6 rounded-2xl border bg-card p-6 text-card-foreground shadow-raised md:p-10',
                        )}
                    >
                        <div className="flex flex-col gap-2">
                            <KindBadge kind={question.kind} />
                            <h2
                                ref={heading}
                                id={headingId}
                                tabIndex={-1}
                                className={cn(
                                    'font-display font-semibold break-words outline-none',
                                    isPhone ? 'text-xl' : 'text-3xl',
                                )}
                            >
                                {question.label}
                            </h2>
                            {question.description && (
                                <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                                    {question.description}
                                </p>
                            )}
                        </div>
                        <AnswerControl
                            key={question.id}
                            question={question}
                            answers={answers}
                            invalid={isInvalid}
                            labelledBy={headingId}
                            disabled={readOnly}
                            className={cn(
                                isPhone &&
                                    '[&_[role=radiogroup]>label]:min-h-11',
                                isPhone &&
                                    question.kind === 'nps' &&
                                    '[&_[role=radiogroup]>label]:basis-1/7',
                            )}
                        />
                        {finishError && (
                            <p
                                role="alert"
                                className="text-sm text-skrum-destructive-text"
                            >
                                {finishError}
                            </p>
                        )}
                        {!isPhone && (
                            <div className="flex items-center justify-between gap-3">
                                {previousButton}
                                {shortcutsOn && (
                                    <KeyHint
                                        question={question}
                                        canScore={!readOnly}
                                    />
                                )}
                                {nextButton}
                            </div>
                        )}
                    </section>
                    <SurveyPrivacyLine />
                </div>
            </div>
            {isPhone && (
                <footer
                    data-slot="survey-flow-footer"
                    className="flex shrink-0 gap-2 border-t bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
                >
                    {previousButton}
                    {nextButton}
                </footer>
            )}
        </div>
    );
}
