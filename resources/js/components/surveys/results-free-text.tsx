import { useId } from 'react';
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
}: {
    label: string;
    entries: SurveyTextEntry[];
}) {
    const { t } = useTrans();
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card"
        >
            <h3
                id={headingId}
                className="font-display text-base font-semibold break-words"
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

/** Every text answer and every comment, per question, in the server's order. */
export function ResultsFreeText({ snapshot }: { snapshot: SurveySnapshot }) {
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
                    />
                );
            })}
        </div>
    );
}
