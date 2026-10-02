import { router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    HeartPulse,
    LayoutGrid,
    Minus,
    PartyPopper,
    Plus,
    UserRoundPlus,
    VenetianMask,
    Vote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement, ReactNode } from 'react';
import TeamRetrosController from '@/actions/App/Http/Controllers/TeamRetrosController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import {
    BlankTemplateId,
    RetroTemplatePicker,
    columnColorClass,
} from '@/components/skrum/retro-template-picker';
import type { RetroTemplate } from '@/components/skrum/retro-template-picker';
import {
    MaxTemplateColumns,
    MaxTemplateNameLength,
} from '@/components/skrum/template-editor';
import { SessionFormFooter } from '@/components/teams/session-create/new-session-dialog';
import type {
    RetroSessionForm,
    SessionFormContext,
} from '@/components/teams/session-create/new-session-dialog';
import { RetroColumnsEditor } from '@/components/teams/session-create/retro-columns-editor';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind, GameOption } from '@/lib/games/types';
import {
    MaxShortcuts,
    defaultTemplateKey,
    draftColumns,
    sameColumns,
    shortcutTemplates,
    toRetroTemplates,
} from '@/lib/retro/template-adapter';
import type { DraftColumn } from '@/lib/retro/template-adapter';
import type {
    CatalogueTemplate,
    CategoryOption,
    LlmAvailability,
} from '@/types';
import { FieldError } from '@/components/teams/session-create/field-error';

export type RetroSessionFormProps = {
    workspaceSlug: string;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
    topTemplates: string[];
    /** Not read any more: the AI summary is set in the session's settings. */
    llm?: LlmAvailability;
    icebreakerGames: GameOption[];
    /** Shows "Save as team template": who may manage the workspace templates. */
    canSaveTemplate: boolean;
    disabledReason?: string;
    /** Name the form opens with. Default: "Retro" and today's date. */
    initialTitle?: string;
    /** Beside "Create & open". A later plan passes "Schedule…" here. */
    secondaryAction?: ReactNode;
};

type Errors = Record<string, string>;

type VisitPage = { props: { catalogue?: CatalogueTemplate[] } };

const DefaultFixedVotes = 5;
const MinVotes = 1;
const MaxVotes = 20;
const ShortcutSkeletons = 6;

/** The retro form of the creation dialog, as `NewSessionDialog` takes it. */
export function retroSessionForm(
    props: RetroSessionFormProps,
): RetroSessionForm {
    return {
        disabledReason: props.disabledReason,
        render: (context) => (
            <RetroSessionFields {...props} context={context} />
        ),
    };
}

function VotesStepper({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) {
    const { t } = useTrans();
    const label = t('Votes per participant');

    return (
        <div
            role="group"
            aria-label={label}
            data-slot="stepper"
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-card"
        >
            <button
                type="button"
                aria-label={t('Decrease :label', { label })}
                disabled={value <= MinVotes}
                onClick={() => onChange(value - 1)}
                className="grid h-full w-7 place-items-center rounded-l-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
                <Minus aria-hidden className="size-3.5" />
            </button>
            <output className="min-w-7 border-x px-1 text-center text-body-sm leading-8 font-semibold tabular-nums">
                {value}
            </output>
            <button
                type="button"
                aria-label={t('Increase :label', { label })}
                disabled={value >= MaxVotes}
                onClick={() => onChange(value + 1)}
                className="grid h-full w-7 place-items-center rounded-r-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
                <Plus aria-hidden className="size-3.5" />
            </button>
        </div>
    );
}

const shortcutClasses =
    'group/shortcut flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border border-input bg-card px-2.5 pt-2 pb-2.5 text-left transition-[background-color,border-color,box-shadow] duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover motion-reduce:transition-none aria-checked:border-primary aria-checked:bg-skrum-primary-soft aria-checked:ring-1 aria-checked:ring-primary aria-checked:ring-inset';

function TemplateShortcuts({
    shortcuts,
    value,
    categoryLabel,
    onValueChange,
    onBrowse,
}: {
    shortcuts: RetroTemplate[];
    value: string;
    categoryLabel: (category: string | null | undefined) => string;
    onValueChange: (id: string) => void;
    onBrowse: () => void;
}) {
    const { t } = useTrans();
    const groupRef = useRef<HTMLDivElement>(null);
    const rovingId = shortcuts.some((item) => item.id === value)
        ? value
        : shortcuts[0]?.id;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const steps: Record<string, number> = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
        };

        if (!(event.key in steps)) {
            return;
        }

        const radios = Array.from(
            groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ??
                [],
        );
        const current = radios.indexOf(event.target as HTMLElement);

        if (current === -1) {
            return;
        }

        event.preventDefault();

        const next =
            radios[
                (current + steps[event.key] + radios.length) % radios.length
            ];

        next.focus();
        onValueChange(next.dataset.templateId ?? value);
    };

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(32)),1fr))] gap-2">
            <div
                ref={groupRef}
                role="radiogroup"
                aria-label={t('Retrospective template')}
                onKeyDown={handleKeyDown}
                className="contents"
            >
                {shortcuts.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        role="radio"
                        aria-checked={template.id === value}
                        tabIndex={template.id === rovingId ? 0 : -1}
                        data-slot="template-shortcut"
                        data-template-id={template.id}
                        onClick={() => onValueChange(template.id)}
                        className={shortcutClasses}
                    >
                        <span className="block truncate text-body-sm font-semibold">
                            {template.id === BlankTemplateId
                                ? t('Start from scratch')
                                : template.name}
                        </span>
                        <span
                            aria-hidden
                            data-slot="template-strip"
                            className="flex h-1.5 w-full gap-0.5"
                        >
                            {template.columns.map((column, index) => (
                                <span
                                    key={index}
                                    className={`min-w-0 flex-1 rounded-full bg-(--col-border) ${columnColorClass(column.color)}`}
                                />
                            ))}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-overline font-normal tracking-normal text-muted-foreground">
                            {template.source === 'workspace' && (
                                <Building2
                                    aria-hidden
                                    className="size-3 shrink-0"
                                />
                            )}
                            <span className="truncate">
                                {template.source === 'workspace'
                                    ? t('Workspace')
                                    : categoryLabel(template.category) ||
                                      (template.columns.length === 1
                                          ? t('1 column')
                                          : t(':count columns', {
                                                count: template.columns.length,
                                            }))}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
            <button
                type="button"
                data-slot="template-browse"
                onClick={onBrowse}
                className="flex min-h-16 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-input px-2.5 text-body-sm font-semibold text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
            >
                <LayoutGrid aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{t('Browse')}</span>
            </button>
        </div>
    );
}

type SettingEntry = {
    key: string;
    label: string;
    htmlFor: string;
    help?: string;
    icon: LucideIcon;
    error?: string;
    control: ReactNode;
};

export function RetroSessionFields({
    workspaceSlug,
    categories,
    catalogue,
    topTemplates,
    icebreakerGames,
    canSaveTemplate,
    initialTitle,
    secondaryAction,
    context,
}: RetroSessionFormProps & { context: SessionFormContext }): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [title, setTitle] = useState(
        () =>
            initialTitle ??
            t('Retro :date', {
                date: new Date().toLocaleDateString(
                    locale as string | undefined,
                    { dateStyle: 'medium' },
                ),
            }),
    );
    const [picked, setPicked] = useState<string | null>(null);
    const [browsing, setBrowsing] = useState(false);
    const [draft, setDraft] = useState<{
        key: string;
        columns: DraftColumn[];
    } | null>(null);
    const [anonymous, setAnonymous] = useState(false);
    const [healthCheck, setHealthCheck] = useState(false);
    const [icebreaker, setIcebreaker] = useState(false);
    const [icebreakerGame, setIcebreakerGame] = useState<GameKind>('draw');
    const [votes, setVotes] = useState<number | null>(null);
    const [guests, setGuests] = useState(false);
    const [saveTemplate, setSaveTemplate] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [catalogue]);

    const templates = useMemo(
        () => toRetroTemplates(catalogue ?? []),
        [catalogue],
    );
    const templateKey =
        picked !== null && templates.some((item) => item.id === picked)
            ? picked
            : defaultTemplateKey(
                  catalogue ?? [],
                  topTemplates,
                  context.intent?.template,
              );
    const selected = templates.find((item) => item.id === templateKey);
    const pristine = useMemo(() => draftColumns(selected), [selected]);
    const columns = draft?.key === templateKey ? draft.columns : pristine;
    const columnsChanged =
        selected !== undefined && !sameColumns(columns, selected.columns);
    const shortcuts = useMemo(() => {
        const top = shortcutTemplates(catalogue ?? [], topTemplates);

        if (
            selected === undefined ||
            top.some((item) => item.id === selected.id)
        ) {
            return top;
        }

        return [...top.slice(0, MaxShortcuts - 1), selected];
    }, [catalogue, topTemplates, selected]);
    const categoryLabel = (category: string | null | undefined): string =>
        categories.find((option) => option.value === category)?.label ?? '';
    const loading = catalogue === undefined;
    const games = icebreakerGames.filter(
        (option) => option.available || option.value === icebreakerGame,
    );

    const settings = (): Record<string, unknown> => ({
        title,
        is_anonymous: anonymous,
        health_check_enabled: healthCheck,
        icebreaker_enabled: icebreaker,
        icebreaker_game: icebreakerGame,
        votes_per_participant: votes,
        guest_access_enabled: guests,
    });

    const columnsPayload = () =>
        columns.map((column) => ({
            title: column.title,
            description: column.description,
            color: column.color,
        }));

    const createRetro = (template: string, withColumns: boolean): void => {
        router.post(
            TeamRetrosController.store({
                workspace: workspaceSlug,
                team: context.team.id,
            }).url,
            {
                ...settings(),
                template,
                ...(withColumns ? { columns: columnsPayload() } : {}),
            },
            {
                onStart: () => setProcessing(true),
                onSuccess: () => context.close(),
                onError: (failed) => setErrors(failed),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const saveTemplateThenCreate = (template: RetroTemplate): void => {
        const name = title.trim().slice(0, MaxTemplateNameLength).trim();

        router.post(
            WorkspaceTemplatesController.store(workspaceSlug).url,
            {
                name,
                category: template.category ?? categories[0]?.value,
                columns: columnsPayload(),
            },
            {
                only: ['catalogue'],
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onError: (failed) => {
                    setProcessing(false);
                    setErrors(
                        Object.fromEntries(
                            Object.entries(failed).map(([field, message]) => [
                                field === 'name' ? 'template_name' : field,
                                message,
                            ]),
                        ),
                    );
                },
                onSuccess: (page) => {
                    const saved = (
                        page as unknown as VisitPage
                    ).props.catalogue?.find(
                        (item) => item.isWorkspace && item.name === name,
                    );

                    setSaveTemplate(false);

                    if (saved === undefined) {
                        createRetro(template.id, columnsChanged);

                        return;
                    }

                    setPicked(saved.key);
                    setDraft(null);
                    createRetro(saved.key, false);
                },
            },
        );
    };

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        if (selected === undefined || processing) {
            return;
        }

        setErrors({});

        if (saveTemplate && canSaveTemplate && columns.length > 0) {
            saveTemplateThenCreate(selected);

            return;
        }

        createRetro(selected.id, columnsChanged);
    };

    const choose = (id: string): void => {
        setPicked(id);
    };

    const settingRows: SettingEntry[] = [
        {
            key: 'anonymous',
            label: t('Anonymous cards'),
            htmlFor: 'new-retro-anonymous',
            help: t('Authors are never shown'),
            icon: VenetianMask,
            control: (
                <Switch
                    id="new-retro-anonymous"
                    checked={anonymous}
                    onCheckedChange={setAnonymous}
                />
            ),
        },
        {
            key: 'votes',
            label: t('Votes per person'),
            htmlFor: 'new-retro-votes-auto',
            help:
                votes === null
                    ? t('Automatic: number of cards plus 3, at most 10.')
                    : t('Spread across all cards'),
            icon: Vote,
            error: errors.votes_per_participant,
            control: (
                <>
                    {votes !== null && (
                        <VotesStepper value={votes} onChange={setVotes} />
                    )}
                    <span aria-hidden className="text-xs text-muted-foreground">
                        {t('Automatic')}
                    </span>
                    <Switch
                        id="new-retro-votes-auto"
                        aria-label={t('Automatic vote limit')}
                        checked={votes === null}
                        onCheckedChange={(checked) =>
                            setVotes(checked ? null : DefaultFixedVotes)
                        }
                    />
                </>
            ),
        },
        {
            key: 'icebreaker',
            label: t('Icebreaker at the start'),
            htmlFor: 'new-retro-icebreaker',
            help: t('5–10 min before writing'),
            icon: PartyPopper,
            error: errors.icebreaker_game,
            control: (
                <>
                    {icebreaker && (
                        <Select
                            value={icebreakerGame}
                            onValueChange={(next) =>
                                setIcebreakerGame(next as GameKind)
                            }
                        >
                            <SelectTrigger
                                id="new-retro-icebreaker-game"
                                size="sm"
                                aria-label={t('Icebreaker game')}
                                className="max-w-40"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {games.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        disabled={!option.available}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Switch
                        id="new-retro-icebreaker"
                        checked={icebreaker}
                        onCheckedChange={setIcebreaker}
                    />
                </>
            ),
        },
        {
            key: 'health-check',
            label: t('Health check'),
            htmlFor: 'new-retro-health-check',
            help: t('The team rates its health statements first'),
            icon: HeartPulse,
            control: (
                <Switch
                    id="new-retro-health-check"
                    checked={healthCheck}
                    onCheckedChange={setHealthCheck}
                />
            ),
        },
    ];

    return (
        <form
            id={context.formId}
            data-slot="retro-session-fields"
            onSubmit={submit}
            className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]"
        >
            <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
                <div className="grid gap-2">
                    <Label htmlFor="new-retro-title">{t('Name')}</Label>
                    <Input
                        id="new-retro-title"
                        value={title}
                        maxLength={120}
                        required
                        autoFocus
                        aria-invalid={
                            errors.title !== undefined ||
                            errors.template_name !== undefined ||
                            undefined
                        }
                        aria-describedby="new-retro-title-error"
                        onChange={(event) => setTitle(event.target.value)}
                    />
                    <div id="new-retro-title-error" className="grid gap-1">
                        <FieldError message={errors.title} />
                        <FieldError message={errors.template_name} />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                            {t('Template')}
                        </span>
                        {browsing ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="max-w-full shrink-0"
                                onClick={() => setBrowsing(false)}
                            >
                                <ArrowLeft aria-hidden />
                                <span className="truncate">{t('Back')}</span>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="max-w-full shrink-0 px-0"
                                onClick={() => setBrowsing(true)}
                            >
                                <span className="truncate">
                                    {t('All templates')}
                                </span>
                            </Button>
                        )}
                    </div>
                    {browsing && (
                        <RetroTemplatePicker
                            value={templateKey}
                            onValueChange={choose}
                            templates={templates}
                            categories={categories}
                            loading={loading}
                            className="max-h-112 overflow-y-auto rounded-lg border p-3"
                        />
                    )}
                    {!browsing && loading && (
                        <div
                            aria-busy="true"
                            className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(32)),1fr))] gap-2"
                        >
                            <span className="sr-only" role="status">
                                {t('Loading templates…')}
                            </span>
                            {Array.from(
                                { length: ShortcutSkeletons },
                                (_, index) => (
                                    <Skeleton
                                        key={index}
                                        aria-hidden
                                        className="h-16 rounded-lg"
                                    />
                                ),
                            )}
                        </div>
                    )}
                    {!browsing && !loading && (
                        <TemplateShortcuts
                            shortcuts={shortcuts}
                            value={templateKey}
                            categoryLabel={categoryLabel}
                            onValueChange={choose}
                            onBrowse={() => setBrowsing(true)}
                        />
                    )}
                    <FieldError message={errors.template} />
                </div>

                {!loading && selected !== undefined && (
                    <RetroColumnsEditor
                        value={columns}
                        max={MaxTemplateColumns}
                        errors={errors}
                        onChange={(next) =>
                            setDraft({ key: templateKey, columns: next })
                        }
                    />
                )}
            </div>

            <div className="flex min-w-0 flex-col gap-4 border-t bg-muted/45 px-4 py-5 md:border-t-0 md:border-l md:px-6">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                        {t('Settings')}
                    </span>
                    <div className="flex flex-col">
                        {settingRows.map(({ key, control, ...row }) => (
                            <SettingRow key={key} {...row}>
                                {control}
                            </SettingRow>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                        {t('Invitation')}
                    </span>
                    <SettingRow
                        label={t('Anonymous guests allowed')}
                        htmlFor="new-retro-guests"
                        help={t('Guests join with a nickname, no account')}
                        icon={UserRoundPlus}
                    >
                        <Switch
                            id="new-retro-guests"
                            checked={guests}
                            onCheckedChange={setGuests}
                        />
                    </SettingRow>
                </div>
            </div>

            <SessionFormFooter
                context={context}
                processing={processing}
                disabled={selected === undefined}
                secondaryAction={secondaryAction}
                start={
                    canSaveTemplate ? (
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                id="new-retro-save-template"
                                checked={saveTemplate}
                                onCheckedChange={(checked) =>
                                    setSaveTemplate(checked === true)
                                }
                            />
                            <Label
                                htmlFor="new-retro-save-template"
                                className="truncate text-body-sm leading-5 font-normal"
                            >
                                {t('Save as team template')}
                            </Label>
                        </div>
                    ) : undefined
                }
            />
        </form>
    );
}
