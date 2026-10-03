import { Copy, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { isChoiceKind, withKind } from '@/lib/surveys/builder-state';
import type { SurveyKind, SurveyQuestionPayload } from '@/lib/surveys/types';
import { cn } from '@/lib/utils';
import { BuilderOptionsEditor } from './builder-options-editor';
import { KindIcons, SurveyKinds, useKindLabel } from './builder-kinds';

const MaxLabelLength = 200;
const MaxEndLabelLength = 60;
const ScalePreview = [1, 2, 3, 4, 5];

/** `edit`: a draft's question; `readonly`: an open or closed survey; `locked`: a health check's statement. */
export type QuestionCardMode = 'edit' | 'readonly' | 'locked';

type BuilderQuestionCardProps = {
    question: SurveyQuestionPayload;
    number: number;
    open: boolean;
    mode: QuestionCardMode;
    /** The drag handle, given by the list while questions can move. */
    handle?: ReactNode;
    /** The server's message after a failed save of this question. */
    error?: string;
    registerLabel?: (node: HTMLInputElement | null) => void;
    onOpen?: () => void;
    onChange?: (question: SurveyQuestionPayload) => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
};

function ScaleRow({ ends }: { ends?: [string, string] }) {
    return (
        <div aria-hidden className="flex flex-col gap-1.5">
            <div className="grid grid-cols-5 gap-2">
                {ScalePreview.map((value) => (
                    <span
                        key={value}
                        className="grid h-10 place-items-center rounded-md border bg-card text-sm font-semibold text-muted-foreground"
                    >
                        {value}
                    </span>
                ))}
            </div>
            {ends !== undefined && (
                <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                    <span>{ends[0]}</span>
                    <span className="text-right">{ends[1]}</span>
                </div>
            )}
        </div>
    );
}

function QuestionMeta({ question }: { question: SurveyQuestionPayload }) {
    const { t } = useTrans();

    if (isChoiceKind(question.kind)) {
        return (
            <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
                {t(':count options', { count: question.options.length })}
            </span>
        );
    }

    if (question.kind === 'text') {
        return (
            <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
                {t('500 characters max')}
            </span>
        );
    }

    return null;
}

/** The kind as the collapsed card shows it: the NPS with its range, as in the mockup (the "Add" bar keeps "NPS"). */
function KindBadge({ kind }: { kind: SurveyKind }) {
    const { t } = useTrans();
    const kindLabel = useKindLabel();

    return (
        <Badge
            variant="outline"
            icon={KindIcons[kind]}
            className="max-sm:hidden"
        >
            {kind === 'nps' ? t('NPS 0 – 10') : kindLabel(kind)}
        </Badge>
    );
}

function QuestionNumber({ value, open }: { value: number; open: boolean }) {
    return (
        <span
            aria-hidden
            className={cn(
                'grid size-6 shrink-0 place-items-center rounded-sm bg-muted text-xs font-bold text-muted-foreground',
                open && 'bg-primary text-primary-foreground',
            )}
        >
            {value}
        </span>
    );
}

/** The fields of an open question, by kind. */
function KindFields({
    question,
    onChange,
}: {
    question: SurveyQuestionPayload;
    onChange: (question: SurveyQuestionPayload) => void;
}) {
    const { t } = useTrans();

    switch (question.kind) {
        case 'scale': {
            const [min, max] = question.scaleLabels ?? [null, null];
            const setEnds = (ends: [string | null, string | null]): void =>
                onChange({ ...question, scaleLabels: ends });

            return (
                <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <label
                                htmlFor={`scale-min-${question.id}`}
                                className="text-xs font-medium"
                            >
                                {t('Label of 1')}
                            </label>
                            <Input
                                id={`scale-min-${question.id}`}
                                value={min ?? ''}
                                maxLength={MaxEndLabelLength}
                                onChange={(event) =>
                                    setEnds([event.target.value || null, max])
                                }
                            />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <label
                                htmlFor={`scale-max-${question.id}`}
                                className="text-xs font-medium"
                            >
                                {t('Label of 5')}
                            </label>
                            <Input
                                id={`scale-max-${question.id}`}
                                value={max ?? ''}
                                maxLength={MaxEndLabelLength}
                                onChange={(event) =>
                                    setEnds([min, event.target.value || null])
                                }
                            />
                        </div>
                    </div>
                    <ScaleRow />
                </>
            );
        }
        case 'nps':
            return (
                <p className="flex justify-between gap-4 text-xs text-muted-foreground">
                    <span>{`0 · ${t('Not at all likely')}`}</span>
                    <span className="text-right">{`10 · ${t('Extremely likely')}`}</span>
                </p>
            );
        case 'single':
        case 'multiple':
            return (
                <BuilderOptionsEditor
                    options={question.options}
                    onChange={(options) => onChange({ ...question, options })}
                />
            );
        case 'text':
            return (
                <p className="text-xs text-muted-foreground">
                    {t('500 characters max')}
                </p>
            );
    }
}

/**
 * One question of the builder: a row when collapsed, its fields when open.
 * Only one question is open at a time; a health check's statements and the
 * questions of a published survey are read only.
 */
export function BuilderQuestionCard({
    question,
    number,
    open,
    mode,
    handle,
    error,
    registerLabel,
    onOpen,
    onChange,
    onDuplicate,
    onDelete,
}: BuilderQuestionCardProps) {
    const { t } = useTrans();
    const kindLabel = useKindLabel();
    const isOpen = open && mode === 'edit';
    const label =
        question.label.trim() === '' ? t('Untitled question') : question.label;
    const errorId = `question-error-${question.id}`;

    const change = (next: SurveyQuestionPayload): void => onChange?.(next);

    return (
        <section
            aria-label={t('Question :number', { number })}
            data-test="survey-question"
            data-open={isOpen ? 'true' : undefined}
            className={cn(
                'min-w-0 rounded-xl border bg-card shadow-card',
                isOpen && 'border-primary shadow-raised ring-1 ring-primary',
                error !== undefined && 'border-destructive',
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-3 px-3.5 py-3 sm:flex-nowrap">
                {handle}
                <QuestionNumber value={number} open={isOpen} />
                {isOpen ? (
                    <>
                        <Select
                            value={question.kind}
                            onValueChange={(kind) =>
                                change(
                                    withKind(question, kind as SurveyKind, [
                                        t('Option 1'),
                                        t('Option 2'),
                                    ]),
                                )
                            }
                        >
                            <SelectTrigger
                                id={`question-kind-${question.id}`}
                                aria-label={t('Kind')}
                                className="w-52 max-w-full min-w-0 shrink"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SurveyKinds.map((kind) => {
                                    const Icon = KindIcons[kind];

                                    return (
                                        <SelectItem key={kind} value={kind}>
                                            <Icon
                                                aria-hidden
                                                className="text-skrum-primary-text"
                                            />
                                            {kindLabel(kind)}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <span className="flex-1" />
                        <Switch
                            id={`question-required-${question.id}`}
                            label={t('Required')}
                            checked={question.isRequired}
                            onCheckedChange={(isRequired) =>
                                change({ ...question, isRequired })
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('Duplicate')}
                            onClick={onDuplicate}
                        >
                            <Copy aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('Delete')}
                            onClick={onDelete}
                        >
                            <Trash2 aria-hidden />
                        </Button>
                    </>
                ) : (
                    <>
                        {mode === 'edit' ? (
                            <button
                                type="button"
                                onClick={onOpen}
                                className="min-w-0 flex-1 truncate rounded-xs text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {label}
                            </button>
                        ) : (
                            <span className="min-w-0 flex-1 truncate font-semibold">
                                {label}
                            </span>
                        )}
                        <QuestionMeta question={question} />
                        <KindBadge kind={question.kind} />
                        {question.isRequired && (
                            <Badge variant="muted">{t('Required')}</Badge>
                        )}
                    </>
                )}
            </div>
            {isOpen && (
                <div className="flex min-w-0 flex-col gap-3 px-3.5 pb-3.5 sm:pl-13">
                    <Input
                        ref={registerLabel}
                        id={`question-label-${question.id}`}
                        aria-label={t('Label')}
                        aria-invalid={
                            question.label.trim() === '' ||
                            error !== undefined ||
                            undefined
                        }
                        aria-describedby={
                            error === undefined ? undefined : errorId
                        }
                        value={question.label}
                        maxLength={MaxLabelLength}
                        onChange={(event) =>
                            change({ ...question, label: event.target.value })
                        }
                        className="h-10 text-base font-semibold"
                    />
                    {error !== undefined && (
                        <p
                            id={errorId}
                            role="alert"
                            className="text-xs text-skrum-destructive-text"
                        >
                            {error}
                        </p>
                    )}
                    <KindFields question={question} onChange={change} />
                </div>
            )}
            {mode === 'locked' && (
                <div className="px-3.5 pb-3.5 sm:pl-13">
                    <ScaleRow
                        ends={[
                            question.scaleLabels?.[0] ?? t('Strongly disagree'),
                            question.scaleLabels?.[1] ?? t('Strongly agree'),
                        ]}
                    />
                </div>
            )}
        </section>
    );
}
