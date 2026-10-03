import { useEffect, useId, useRef } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type {
    SurveyQuestionPayload,
    SurveySnapshot,
    SurveyTextEntry,
} from '@/lib/surveys/types';

/** A text question, or a scale or NPS question that takes comments. */
export function takesFreeText(question: SurveyQuestionPayload): boolean {
    return question.kind === 'text' || question.allowsComment;
}

function FreeTextSection({
    label,
    entries,
    isTarget,
    onReached,
}: {
    label: string;
    entries: SurveyTextEntry[];
    isTarget: boolean;
    onReached?: () => void;
}) {
    const { t } = useTrans();
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (!isTarget || heading.current === null) {
            return;
        }

        heading.current.scrollIntoView?.({ block: 'start' });
        heading.current.focus({ preventScroll: true });
        onReached?.();
    }, [isTarget, onReached]);

    return (
        <section
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card"
        >
            <h3
                ref={heading}
                id={headingId}
                tabIndex={-1}
                className="scroll-mt-20 font-display text-base font-semibold break-words"
            >
                {label}
            </h3>
            {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {t('No answers yet.')}
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="min-w-0 border-s-2 border-border ps-3 text-sm break-words whitespace-pre-wrap"
                        >
                            {entry.text}
                            {entry.isMine && (
                                <span className="block text-xs text-muted-foreground">
                                    {t('Your answer')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

type ResultsFreeTextProps = {
    snapshot: SurveySnapshot;
    /** The question to bring into view and focus, as the summary's text card asked. */
    targetQuestionId?: string | null;
    onTargetReached?: () => void;
};

/** Every text answer and every comment, per question, in the server's order. */
export function ResultsFreeText({
    snapshot,
    targetQuestionId = null,
    onTargetReached,
}: ResultsFreeTextProps) {
    const summaries = snapshot.results?.questions ?? {};

    return (
        <div className="flex flex-col gap-4">
            {snapshot.questions.filter(takesFreeText).map((question) => {
                const summary = summaries[question.id];
                const entries =
                    question.kind === 'text'
                        ? summary?.answers
                        : summary?.comments;

                return (
                    <FreeTextSection
                        key={question.id}
                        label={question.label}
                        entries={entries ?? []}
                        isTarget={question.id === targetQuestionId}
                        onReached={onTargetReached}
                    />
                );
            })}
        </div>
    );
}
