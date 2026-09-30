import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { SurveyKind, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';

const MinOptions = 2;
const MaxOptions = 10;

export type SurveyDraft = {
    kind: SurveyKind;
    question: string;
    description: string;
    options: string[];
};

export const SurveyKindLabels: Record<SurveyKind, string> = {
    single: 'Single choice',
    multiple: 'Multiple choice',
    text: 'Free text',
};

function draftOf(survey?: SurveyPayload): SurveyDraft {
    if (!survey) {
        return {
            kind: 'single',
            question: '',
            description: '',
            options: ['', ''],
        };
    }

    return {
        kind: survey.kind,
        question: survey.question,
        description: survey.description ?? '',
        options:
            survey.kind === 'text'
                ? ['', '']
                : survey.options.map((option) => option.label),
    };
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey?: SurveyPayload;
};

export function SurveyDialog({ open, onOpenChange, survey }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <SurveyForm
                        survey={survey}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SurveyForm({
    survey,
    onDone,
}: {
    survey?: SurveyPayload;
    onDone: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [draft, setDraft] = useState<SurveyDraft>(() => draftOf(survey));
    const [showVoters, setShowVoters] = useState(survey?.showVoters ?? false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const isChoice = draft.kind !== 'text';

    const setOption = (index: number, label: string) =>
        setDraft((current) => ({
            ...current,
            options: current.options.map((option, position) =>
                position === index ? label : option,
            ),
        }));

    const save = async (event: FormEvent) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSaving(true);
        setError(null);

        const description = draft.description.trim();
        const route = survey
            ? SurveysController.update({ retro: retro.id, survey: survey.id })
            : SurveysController.store(retro.id);

        try {
            const response = await retroRequest<{ survey: SurveyPayload }>(
                route,
                {
                    kind: draft.kind,
                    question: draft.question.trim(),
                    description: description === '' ? null : description,
                    options: isChoice
                        ? draft.options.map((option) => option.trim())
                        : [],
                    show_voters: !retro.isAnonymous && showVoters,
                },
            );

            ctx.invalidateSurvey(response.survey.id);
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
            onDone();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onDone();

                return;
            }

            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>
                {survey ? t('Edit survey') : t('New survey')}
            </DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="survey-kind">{t('Answer type')}</Label>
                <Select
                    value={draft.kind}
                    onValueChange={(value) =>
                        setDraft((current) => ({
                            ...current,
                            kind: value as SurveyKind,
                        }))
                    }
                >
                    <SelectTrigger id="survey-kind">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.keys(SurveyKindLabels) as SurveyKind[]).map(
                            (kind) => (
                                <SelectItem key={kind} value={kind}>
                                    {t(SurveyKindLabels[kind])}
                                </SelectItem>
                            ),
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="survey-question">{t('Question')}</Label>
                <Input
                    id="survey-question"
                    value={draft.question}
                    maxLength={200}
                    required
                    onChange={(event) =>
                        setDraft((current) => ({
                            ...current,
                            question: event.target.value,
                        }))
                    }
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="survey-description">
                    {t('Description (optional)')}
                </Label>
                <Textarea
                    id="survey-description"
                    value={draft.description}
                    maxLength={500}
                    rows={2}
                    onChange={(event) =>
                        setDraft((current) => ({
                            ...current,
                            description: event.target.value,
                        }))
                    }
                />
            </div>

            {isChoice && (
                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        {t('Options')}
                    </legend>
                    {draft.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                value={option}
                                maxLength={100}
                                required
                                aria-label={t('Option :number', {
                                    number: index + 1,
                                })}
                                onChange={(event) =>
                                    setOption(index, event.target.value)
                                }
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={t('Remove option :number', {
                                    number: index + 1,
                                })}
                                disabled={draft.options.length <= MinOptions}
                                onClick={() =>
                                    setDraft((current) => ({
                                        ...current,
                                        options: current.options.filter(
                                            (_, position) => position !== index,
                                        ),
                                    }))
                                }
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="justify-self-start"
                        disabled={draft.options.length >= MaxOptions}
                        onClick={() =>
                            setDraft((current) => ({
                                ...current,
                                options: [...current.options, ''],
                            }))
                        }
                    >
                        <Plus className="size-4" />
                        {t('Add option')}
                    </Button>
                </fieldset>
            )}

            <div className="grid gap-1">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="survey-show-voters"
                        checked={!retro.isAnonymous && showVoters}
                        disabled={retro.isAnonymous}
                        onCheckedChange={(checked) =>
                            setShowVoters(checked === true)
                        }
                    />
                    <Label htmlFor="survey-show-voters">
                        {t('Show who answered')}
                    </Label>
                </div>
                {retro.isAnonymous && (
                    <p className="text-xs text-muted-foreground">
                        {t('Names are never shown on anonymous retros.')}
                    </p>
                )}
            </div>

            <InputError message={error ?? undefined} />

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
