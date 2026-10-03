import { Plus } from 'lucide-react';
import { useId } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { MaxQuestions } from '@/lib/surveys/builder-state';
import type { SurveyKind } from '@/lib/surveys/types';
import { KindIcons, SurveyKinds, useKindLabel } from './builder-kinds';

type BuilderAddBarProps = {
    questionCount: number;
    busy?: boolean;
    onAdd: (kind: SurveyKind) => void;
};

/** The dashed "Add" bar: one chip per kind, all disabled at the question limit. */
export function BuilderAddBar({
    questionCount,
    busy = false,
    onAdd,
}: BuilderAddBarProps) {
    const { t } = useTrans();
    const kindLabel = useKindLabel();
    const reasonId = useId();
    const isFull = questionCount >= MaxQuestions;

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div
                role="group"
                aria-label={t('Add a question')}
                aria-describedby={isFull ? reasonId : undefined}
                data-slot="survey-add-bar"
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-input px-3 py-2.5"
            >
                <span
                    aria-hidden
                    className="mr-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
                >
                    <Plus className="size-4" />
                    {t('Add')}
                </span>
                {SurveyKinds.map((kind) => {
                    const Icon = KindIcons[kind];

                    return (
                        <button
                            key={kind}
                            type="button"
                            disabled={isFull || busy}
                            onClick={() => onAdd(kind)}
                            className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Icon
                                aria-hidden
                                className="size-4 shrink-0 text-skrum-primary-text"
                            />
                            <span className="truncate">{kindLabel(kind)}</span>
                        </button>
                    );
                })}
            </div>
            {isFull && (
                <p id={reasonId} className="text-xs text-muted-foreground">
                    {t('A survey can have at most 30 questions.')}
                </p>
            )}
        </div>
    );
}
