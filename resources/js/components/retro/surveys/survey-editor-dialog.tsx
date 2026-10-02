import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { SurveyKind, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { SurveyDraftField } from './survey-draft-field';

const MinOptions = 2;
const MaxOptions = 10;
const SurveyKinds: SurveyKind[] = ['single', 'multiple', 'text'];

export type SurveyDraft = {
    kind: SurveyKind;
    question: string;
    description: string;
    options: string[];
};

export type SurveyEditor = {
    open: boolean;
    /** The survey being edited; none when a new one is written. */
    survey: SurveyPayload | undefined;
    /** Changes at each opening: the form starts again from it. */
    session: number;
    openCreate: () => void;
    openEdit: (survey: SurveyPayload) => void;
    close: () => void;
};

type EditorState = Pick<SurveyEditor, 'open' | 'survey' | 'session'>;

/** The state of one survey dialog: closed, writing a new survey, or editing one. */
export function useSurveyEditor(): SurveyEditor {
    const [state, setState] = useState<EditorState>({
        open: false,
        survey: undefined,
        session: 0,
    });

    return {
        ...state,
        openCreate: () =>
            setState((current) => ({
                open: true,
                survey: undefined,
                session: current.session + 1,
            })),
        openEdit: (survey) =>
            setState((current) => ({
                open: true,
                survey,
                session: current.session + 1,
            })),
        close: () => setState((current) => ({ ...current, open: false })),
    };
}

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

export function SurveyEditorDialog({ editor }: { editor: SurveyEditor }) {
    const ctx = useBoard();

    return (
        <SurveyEditorForm
            key={editor.session}
            open={editor.open && !ctx.sessionExpired}
            survey={editor.survey}
            onClose={editor.close}
        />
    );
}

function SurveyEditorForm({
    open,
    survey,
    onClose,
}: {
    open: boolean;
    survey?: SurveyPayload;
    onClose: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [draft, setDraft] = useState<SurveyDraft>(() => draftOf(survey));
    const [showVoters, setShowVoters] = useState(survey?.showVoters ?? false);
    const [error, setError] = useState<string | null>(null);
    const isChoice = draft.kind !== 'text';

    const kindLabels: Record<SurveyKind, string> = {
        single: t('Single choice'),
        multiple: t('Multiple choice'),
        text: t('Free text'),
    };

    const setOption = (index: number, label: string) =>
        setDraft((current) => ({
            ...current,
            options: current.options.map((option, position) =>
                position === index ? label : option,
            ),
        }));

    const save = async () => {
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
        } catch (caught) {
            const message = ctx.handleError(caught);

            // An expired session has its own banner: the dialog just closes.
            if (message === null) {
                return;
            }

            setError(message);

            throw caught;
        }
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
            title={survey ? t('Edit survey') : t('New survey')}
            submitLabel={t('Save')}
            onSubmit={save}
            error={error ?? undefined}
        >
            {!survey && (
                <SurveyDraftField
                    kind={draft.kind}
                    onDraft={(generated) =>
                        setDraft((current) => ({
                            ...current,
                            question: generated.question,
                            description: generated.description ?? '',
                            options:
                                current.kind === 'text'
                                    ? current.options
                                    : generated.options,
                        }))
                    }
                />
            )}

            <div className="grid min-w-0 gap-2">
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
                    <SelectTrigger id="survey-kind" className="w-full min-w-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SurveyKinds.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                                {kindLabels[kind]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid min-w-0 gap-2">
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

            <div className="grid min-w-0 gap-2">
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
                <fieldset className="grid min-w-0 gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        {t('Options')}
                    </legend>
                    {draft.options.map((option, index) => (
                        <div
                            key={index}
                            className="flex min-w-0 items-center gap-2"
                        >
                            <Input
                                value={option}
                                maxLength={100}
                                required
                                className="min-w-0 flex-1"
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
                                className="shrink-0"
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
                                <X aria-hidden />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="max-w-full min-w-0 justify-self-start"
                        disabled={draft.options.length >= MaxOptions}
                        onClick={() =>
                            setDraft((current) => ({
                                ...current,
                                options: [...current.options, ''],
                            }))
                        }
                    >
                        <Plus aria-hidden />
                        <span className="truncate">{t('Add option')}</span>
                    </Button>
                </fieldset>
            )}

            <Switch
                id="survey-show-voters"
                label={t('Show who answered')}
                description={
                    retro.isAnonymous
                        ? t('Names are never shown on anonymous retros.')
                        : undefined
                }
                checked={!retro.isAnonymous && showVoters}
                disabled={retro.isAnonymous}
                onCheckedChange={setShowVoters}
            />
        </FormDialog>
    );
}
