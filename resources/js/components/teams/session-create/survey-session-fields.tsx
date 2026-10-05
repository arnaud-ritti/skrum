import { router, usePage } from '@inertiajs/react';
import { UserRoundPlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';
import TeamSurveysController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveysController';
import { FieldError } from '@/components/teams/session-create/field-error';
import { SessionFormFooter } from '@/components/teams/session-create/new-session-dialog';
import type {
    SessionFormContext,
    SurveySessionForm,
} from '@/components/teams/session-create/new-session-dialog';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Badge } from '@/components/ui/badge';
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
import { useTrans } from '@/hooks/use-trans';
import type {
    SurveyTemplateOption,
    TeamSurveySummary,
} from '@/lib/surveys/types';

export type SurveySessionFormProps = {
    workspaceSlug: string;
    templates: SurveyTemplateOption[];
    /** The team's surveys: the ones that are not drafts can be started from. */
    surveys: TeamSurveySummary[];
    disabledReason?: string;
};

type Errors = Record<string, string>;

type SurveyStoreBody = {
    title: string;
    template?: string;
    source_survey_id?: string;
    guest_access_enabled?: boolean;
};

type Choice = {
    value: string;
    name: string;
    line: string;
    builtIn: boolean;
    disabledReason?: string;
};

const BlankChoice = 'blank';
const PreviousChoice = 'previous';
const MaxTitleLength = 120;

/** The survey form of the creation dialog, as `NewSessionDialog` takes it. */
export function surveySessionForm(
    props: SurveySessionFormProps,
): SurveySessionForm {
    return {
        disabledReason: props.disabledReason,
        render: (context) => (
            <SurveySessionFields {...props} context={context} />
        ),
    };
}

function useChoices(
    templates: SurveyTemplateOption[],
    sources: TeamSurveySummary[],
): Choice[] {
    const { t } = useTrans();
    const lineOf = (template: SurveyTemplateOption): string => {
        const count = template.questionCount;

        if (template.key === 'health_check') {
            return count === 1
                ? t('1 statement · scored 1 to 5')
                : t(':count statements · scored 1 to 5', { count });
        }

        if (template.key === 'team_pulse') {
            return count === 1
                ? t('1 question')
                : t(':count questions', { count });
        }

        return template.description;
    };

    return [
        ...templates.map((template) => ({
            value: template.key ?? BlankChoice,
            name: template.name,
            line: lineOf(template),
            builtIn: template.key === 'health_check',
        })),
        {
            value: PreviousChoice,
            name: t('A previous survey'),
            line: t('Copy the questions of an earlier survey'),
            builtIn: false,
            disabledReason:
                sources.length === 0
                    ? t('No survey to start from yet')
                    : undefined,
        },
    ];
}

const choiceClasses =
    'flex min-w-0 cursor-pointer flex-col gap-1 rounded-lg border border-input bg-card px-2.5 pt-2 pb-2.5 text-left transition-[background-color,border-color,box-shadow] duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover motion-reduce:transition-none aria-checked:border-primary aria-checked:bg-skrum-primary-soft aria-checked:ring-1 aria-checked:ring-primary aria-checked:ring-inset aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:bg-muted aria-disabled:hover:bg-muted';

function StartFrom({
    choices,
    value,
    onValueChange,
    errorId,
}: {
    choices: Choice[];
    value: string;
    onValueChange: (value: string) => void;
    /** The id of the refusal shown under the choices, while there is one. */
    errorId?: string;
}) {
    const { t } = useTrans();
    const idPrefix = useId();
    const groupRef = useRef<HTMLDivElement>(null);
    const usable = choices.filter((choice) => !choice.disabledReason);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const steps: Record<string, number> = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
        };

        if (!(event.key in steps) || usable.length === 0) {
            return;
        }

        event.preventDefault();

        const current = usable.findIndex((choice) => choice.value === value);
        const next =
            usable[
                (current + steps[event.key] + usable.length) % usable.length
            ];

        onValueChange(next.value);
        groupRef.current
            ?.querySelector<HTMLElement>(`[data-choice="${next.value}"]`)
            ?.focus();
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <span
                id={`${idPrefix}-label`}
                className="truncate text-sm font-semibold"
            >
                {t('Start from')}
            </span>
            <div
                ref={groupRef}
                role="radiogroup"
                aria-labelledby={`${idPrefix}-label`}
                aria-invalid={errorId === undefined ? undefined : true}
                aria-describedby={errorId}
                onKeyDown={handleKeyDown}
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(40)),1fr))] gap-2"
            >
                {choices.map((choice) => {
                    const disabled = choice.disabledReason !== undefined;
                    const nameId = `${idPrefix}-${choice.value}-name`;
                    const lineId = `${idPrefix}-${choice.value}-line`;

                    return (
                        <button
                            key={choice.value}
                            type="button"
                            role="radio"
                            aria-checked={choice.value === value}
                            aria-disabled={disabled || undefined}
                            aria-labelledby={nameId}
                            aria-describedby={lineId}
                            tabIndex={choice.value === value ? 0 : -1}
                            data-slot="survey-start-choice"
                            data-choice={choice.value}
                            onClick={() => {
                                if (!disabled) {
                                    onValueChange(choice.value);
                                }
                            }}
                            className={choiceClasses}
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    id={nameId}
                                    className="truncate text-body-sm font-semibold"
                                >
                                    {choice.name}
                                </span>
                                {choice.builtIn && (
                                    <Badge variant="outline">
                                        {t('Built-in')}
                                    </Badge>
                                )}
                            </span>
                            <span
                                id={lineId}
                                className={
                                    disabled
                                        ? 'line-clamp-2 text-xs text-foreground'
                                        : 'line-clamp-2 text-xs text-muted-foreground'
                                }
                            >
                                {choice.disabledReason ?? choice.line}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function SurveySessionFields({
    workspaceSlug,
    templates,
    surveys,
    context,
}: SurveySessionFormProps & {
    context: SessionFormContext;
}): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const sources = surveys.filter((survey) => survey.status !== 'draft');
    const choices = useChoices(templates, sources);
    const intentChoice = choices.find(
        (choice) =>
            choice.value === context.intent?.template &&
            choice.value !== PreviousChoice,
    );
    const [choice, setChoice] = useState<string>(
        intentChoice?.value ?? BlankChoice,
    );
    const [sourceId, setSourceId] = useState<string | undefined>(
        sources[0]?.id,
    );
    const [typedTitle, setTypedTitle] = useState<string | null>(null);
    const [guests, setGuests] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);
    const fromPrevious = choice === PreviousChoice;
    const source =
        sources.find((survey) => survey.id === sourceId) ?? sources[0];
    const date = new Date().toLocaleDateString(locale as string | undefined, {
        day: 'numeric',
        month: 'short',
    });

    const prefilledTitle = (): string => {
        if (fromPrevious) {
            return source === undefined
                ? ''
                : t('Copy of :name', { name: source.title }).slice(
                      0,
                      MaxTitleLength,
                  );
        }

        if (choice === BlankChoice) {
            return t('Survey :date', { date });
        }

        const template = choices.find((item) => item.value === choice);

        return t(':template :date', { template: template?.name ?? '', date });
    };

    const title = typedTitle ?? prefilledTitle();

    const body = (): SurveyStoreBody => {
        if (fromPrevious) {
            return { title, source_survey_id: source?.id };
        }

        return {
            title,
            ...(choice === BlankChoice ? {} : { template: choice }),
            guest_access_enabled: guests,
        };
    };

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        if (processing || title.trim() === '') {
            return;
        }

        if (fromPrevious && source === undefined) {
            return;
        }

        setErrors({});

        router.post(
            TeamSurveysController.store({
                workspace: workspaceSlug,
                team: context.team.id,
            }).url,
            body(),
            {
                onStart: () => setProcessing(true),
                onSuccess: () => context.close(),
                onError: (failed) => setErrors(failed),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <form
            id={context.formId}
            data-slot="survey-session-fields"
            onSubmit={submit}
            className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]"
        >
            <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
                <div className="grid gap-2">
                    <Label htmlFor="new-survey-title">{t('Name')}</Label>
                    <Input
                        id="new-survey-title"
                        value={title}
                        maxLength={MaxTitleLength}
                        required
                        autoFocus
                        aria-invalid={errors.title !== undefined || undefined}
                        aria-describedby={
                            errors.title === undefined
                                ? undefined
                                : 'new-survey-title-error'
                        }
                        onChange={(event) => setTypedTitle(event.target.value)}
                    />
                    <FieldError
                        id="new-survey-title-error"
                        message={errors.title}
                    />
                </div>

                <StartFrom
                    choices={choices}
                    value={choice}
                    onValueChange={setChoice}
                    errorId={
                        errors.template === undefined
                            ? undefined
                            : 'new-survey-template-error'
                    }
                />
                <FieldError
                    id="new-survey-template-error"
                    message={errors.template}
                />

                {fromPrevious && (
                    <div className="grid min-w-0 gap-2">
                        <Label htmlFor="new-survey-source">{t('Survey')}</Label>
                        <Select value={source?.id} onValueChange={setSourceId}>
                            <SelectTrigger
                                id="new-survey-source"
                                className="w-full max-w-full"
                                aria-invalid={
                                    errors.source_survey_id !== undefined ||
                                    undefined
                                }
                                aria-describedby={
                                    errors.source_survey_id === undefined
                                        ? undefined
                                        : 'new-survey-source-error'
                                }
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {sources.map((survey) => (
                                    <SelectItem
                                        key={survey.id}
                                        value={survey.id}
                                        className="max-w-full"
                                    >
                                        <span className="truncate">
                                            {survey.title}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError
                            id="new-survey-source-error"
                            message={errors.source_survey_id}
                        />
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-col gap-4 border-t bg-muted/45 px-4 py-5 md:border-t-0 md:border-l md:px-6">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                        {t('Invitation')}
                    </span>
                    {fromPrevious ? (
                        <p className="text-xs text-muted-foreground">
                            {t('Its settings are copied from that survey.')}
                        </p>
                    ) : (
                        <SettingRow
                            label={t('Allow guests without an account')}
                            htmlFor="new-survey-guests"
                            help={t('Guests join with a nickname, no account')}
                            icon={UserRoundPlus}
                            error={errors.guest_access_enabled}
                        >
                            <Switch
                                id="new-survey-guests"
                                checked={guests}
                                onCheckedChange={setGuests}
                            />
                        </SettingRow>
                    )}
                </div>
            </div>

            <SessionFormFooter
                context={context}
                processing={processing}
                disabled={fromPrevious && source === undefined}
            />
        </form>
    );
}
