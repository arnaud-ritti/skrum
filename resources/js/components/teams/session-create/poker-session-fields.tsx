import { router, usePage } from '@inertiajs/react';
import {
    Eye,
    EyeOff,
    Info,
    RefreshCw,
    Timer,
    Upload,
    UserRoundPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import TeamPokerGamesController from '@/actions/App/Http/Controllers/TeamPokerGamesController';
import { DeckEditor } from '@/components/skrum/deck-editor';
import type { DeckDraft } from '@/components/skrum/deck-editor';
import { DeckMinValues, DeckPicker } from '@/components/skrum/deck-picker';
import { SessionFormFooter } from '@/components/teams/session-create/new-session-dialog';
import type {
    PokerSessionForm,
    SessionFormContext,
} from '@/components/teams/session-create/new-session-dialog';
import {
    PokerTasksField,
    emptyPokerTasks,
    importedTickets,
    taskTitles,
    tasksProblem,
} from '@/components/teams/session-create/poker-tasks-field';
import type { PokerTasksValue } from '@/components/teams/session-create/poker-tasks-field';
import { SettingRow } from '@/components/teams/session-create/setting-row';
import { Alert } from '@/components/ui/alert';
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
import {
    CustomDeckId,
    deckToPayload,
    initialDeckId,
    serverErrorsToDeckErrors,
    toCustomDeck,
    toDecks,
} from '@/lib/poker/deck-adapter';
import type { DefaultPokerDeck } from '@/lib/poker/deck-adapter';
import {
    taskTimerFromChoice,
    taskTimerOptions,
    writableSource,
    writeBackChoice,
    writeBackOptions,
    writeBackPayload,
} from '@/lib/poker/game-options';
import { TrackerLabels } from '@/lib/poker/types';
import type { PokerTrackerSourceRow } from '@/lib/poker/types';
import type { PokerDeckOption, SavedPokerDeck } from '@/types';
import { FieldError } from '@/components/teams/session-create/field-error';

export type PokerSessionFormProps = {
    workspaceSlug: string;
    deckOptions: PokerDeckOption[];
    /** Decks of the team and of its workspace. */
    savedDecks: SavedPokerDeck[];
    defaultPokerDeck: DefaultPokerDeck;
    disabledReason?: string;
    /** Name the form opens with. Default: "Poker" and today's date. */
    initialTitle?: string;
    /** A deck already typed for this game when the form opens. */
    initialCustomDeck?: DeckDraft;
    /** Tasks already typed when the form opens, one per line. */
    initialTasks?: string;
    /** Beside "Create & open". A later plan passes "Schedule…" here. */
    secondaryAction?: ReactNode;
    /**
     * The team's trackers: those that can import give the "Import from" tab;
     * the import tab's source, or else the first that can write back, gets
     * the "Write estimates" row.
     */
    pokerSources?: PokerTrackerSourceRow[];
};

type Errors = Record<string, string>;

type SettingEntry = {
    key: string;
    label: string;
    htmlFor: string;
    help?: string;
    icon: LucideIcon;
    error?: string;
    control: ReactNode;
};

/** The poker form of the creation dialog, as `NewSessionDialog` takes it. */
export function pokerSessionForm(
    props: PokerSessionFormProps,
): PokerSessionForm {
    return {
        disabledReason: props.disabledReason,
        render: (context) => (
            <PokerSessionFields {...props} context={context} />
        ),
    };
}

function emptyDeckDraft(): DeckDraft {
    return { name: '', values: [], unknownCard: true, breakCard: true };
}

function firstError(errors: Errors, field: string): string | undefined {
    const itemKey = Object.keys(errors).find((key) =>
        key.startsWith(`${field}.`),
    );

    return (
        errors[field] ?? (itemKey === undefined ? undefined : errors[itemKey])
    );
}

function tasksError(errors: Errors): string | undefined {
    return firstError(errors, 'tasks');
}

function importError(errors: Errors): string | undefined {
    return firstError(errors, 'import_ids') ?? errors.import_source;
}

export function PokerSessionFields({
    workspaceSlug,
    deckOptions,
    savedDecks,
    defaultPokerDeck,
    initialTitle,
    initialCustomDeck,
    initialTasks,
    secondaryAction,
    pokerSources = [],
    context,
}: PokerSessionFormProps & { context: SessionFormContext }): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [title, setTitle] = useState(
        () =>
            initialTitle ??
            t('Poker :date', {
                date: new Date().toLocaleDateString(
                    locale as string | undefined,
                    { dateStyle: 'medium' },
                ),
            }),
    );
    const [picked, setPicked] = useState<string | null>(
        initialCustomDeck === undefined ? null : CustomDeckId,
    );
    const [customDeck, setCustomDeck] = useState<DeckDraft | null>(
        initialCustomDeck ?? null,
    );
    const [editorDraft, setEditorDraft] = useState<DeckDraft | null>(null);
    const [unfinishedDeck, setUnfinishedDeck] = useState(false);
    const [tasks, setTasks] = useState<PokerTasksValue>(() =>
        initialTasks === undefined
            ? emptyPokerTasks()
            : { mode: 'type', text: initialTasks },
    );
    const [autoReveal, setAutoReveal] = useState(false);
    const [spectator, setSpectator] = useState(false);
    const [guests, setGuests] = useState(false);
    const [taskTimer, setTaskTimer] = useState('off');
    const [revote, setRevote] = useState(false);
    const importSources = pokerSources
        .filter((source) => source.canImport)
        .map((source) => source.source);
    const tickets = importedTickets(tasks, importSources);
    const ticketSource =
        tickets === null
            ? undefined
            : pokerSources.find(
                  (source) =>
                      source.source === tickets.source && source.canWriteBack,
              );
    const writeSource =
        tickets === null
            ? writableSource(pokerSources)
            : (ticketSource ?? null);
    const [writeBackPicked, setWriteBack] = useState<string | null>(null);
    const writeBack =
        writeSource === null
            ? null
            : writeBackPicked !== null &&
                writeBackOptions(writeSource, t).some(
                    (option) => option.value === writeBackPicked,
                )
              ? writeBackPicked
              : writeBackChoice(writeSource, true, null);
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);
    const [refusedDeckId, setRefusedDeckId] = useState<string | null>(null);

    const decks = useMemo(
        () => [
            ...toDecks(deckOptions, savedDecks)
                .filter((deck) => deck.id !== refusedDeckId)
                .map((deck) => ({
                    ...deck,
                    canManage: false,
                })),
            ...(customDeck === null
                ? []
                : [toCustomDeck(customDeck, t('Custom deck'))]),
        ],
        [deckOptions, savedDecks, refusedDeckId, customDeck, t],
    );
    const deckId =
        picked !== null && decks.some((deck) => deck.id === picked)
            ? picked
            : initialDeckId(decks, defaultPokerDeck, context.intent?.deck);
    const editing = editorDraft !== null;
    const deckErrors = serverErrorsToDeckErrors(errors);

    const withoutDeckErrors = (current: Errors): Errors =>
        Object.fromEntries(
            Object.entries(current).filter(
                ([key]) =>
                    key !== 'save_deck_as' && !key.startsWith('custom_cards'),
            ),
        );

    const openEditor = (): void => {
        setUnfinishedDeck(false);
        setEditorDraft(customDeck ?? emptyDeckDraft());
    };

    const acceptEditorDraft = (): void => {
        if (editorDraft === null) {
            return;
        }

        setCustomDeck(editorDraft);
        setPicked(CustomDeckId);
        setEditorDraft(null);
        setUnfinishedDeck(false);
    };

    const createGame = (
        deck: Record<string, unknown>,
        typedDeck: DeckDraft | null,
    ): void => {
        const titles = taskTitles(tasks);

        router.post(
            TeamPokerGamesController.store({
                workspace: workspaceSlug,
                team: context.team.id,
            }).url,
            {
                title,
                ...deck,
                auto_reveal: autoReveal,
                spectator,
                task_timer_seconds: taskTimerFromChoice(taskTimer),
                revote_after_reveal: revote,
                ...(writeSource === null || writeBack === null
                    ? {}
                    : writeBackPayload(writeBack)),
                guest_access_enabled: guests,
                ...(tickets !== null
                    ? { import_source: tickets.source, import_ids: tickets.ids }
                    : {}),
                ...(tickets === null && titles.length > 0
                    ? { tasks: titles }
                    : {}),
            },
            {
                onStart: () => setProcessing(true),
                onSuccess: () => context.close(),
                onError: (failed) => {
                    setErrors(failed);

                    if (failed.saved_deck_id !== undefined) {
                        setRefusedDeckId(
                            typeof deck.saved_deck_id === 'string'
                                ? deck.saved_deck_id
                                : null,
                        );
                        setPicked(null);
                        router.reload({ only: ['pokerDecks'] });
                    }

                    const failedDeck = serverErrorsToDeckErrors(failed);

                    if (
                        typedDeck !== null &&
                        (failedDeck.name !== undefined ||
                            failedDeck.values !== undefined)
                    ) {
                        setEditorDraft((current) => current ?? typedDeck);
                    }
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        if (processing || tasksProblem(tasks) !== null) {
            return;
        }

        if (tickets !== null && tickets.ids.length === 0) {
            setErrors({
                import_ids: t('Pick at least one ticket, or choose “Later”.'),
            });

            return;
        }

        setErrors({});

        if (editorDraft !== null) {
            if (editorDraft.values.length < DeckMinValues) {
                setUnfinishedDeck(true);

                return;
            }

            const draft = editorDraft;

            acceptEditorDraft();
            createGame(deckToPayload(toCustomDeck(draft, ''), draft), draft);

            return;
        }

        const selected = decks.find((deck) => deck.id === deckId);

        if (selected === undefined) {
            return;
        }

        createGame(
            deckToPayload(selected, customDeck),
            selected.source === 'custom' ? customDeck : null,
        );
    };

    const settingRows: SettingEntry[] = [
        {
            key: 'auto-reveal',
            label: t('Auto reveal'),
            htmlFor: 'new-poker-auto-reveal',
            help: t('When everyone has voted'),
            icon: Eye,
            control: (
                <Switch
                    id="new-poker-auto-reveal"
                    checked={autoReveal}
                    onCheckedChange={setAutoReveal}
                />
            ),
        },
        {
            key: 'spectator',
            label: t('Facilitator in “Watch only”'),
            htmlFor: 'new-poker-spectator',
            help: t('You run the game without voting'),
            icon: EyeOff,
            control: (
                <Switch
                    id="new-poker-spectator"
                    checked={spectator}
                    onCheckedChange={setSpectator}
                />
            ),
        },
        {
            key: 'task-timer',
            label: t('Timer per task'),
            htmlFor: 'new-poker-task-timer',
            help: t('Nudges after the delay'),
            icon: Timer,
            error: errors.task_timer_seconds,
            control: (
                <Select value={taskTimer} onValueChange={setTaskTimer}>
                    <SelectTrigger
                        id="new-poker-task-timer"
                        size="sm"
                        aria-label={t('Timer per task')}
                        className="max-w-40"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {taskTimerOptions(t).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ),
        },
        {
            key: 'revote',
            label: t('Change vote after reveal'),
            htmlFor: 'new-poker-revote',
            help: t('Before the estimate is saved'),
            icon: RefreshCw,
            error: errors.revote_after_reveal,
            control: (
                <Switch
                    id="new-poker-revote"
                    checked={revote}
                    onCheckedChange={setRevote}
                />
            ),
        },
        ...(writeSource === null || writeBack === null
            ? []
            : [
                  {
                      key: 'write-back',
                      label: t('Write estimates to :source', {
                          source: TrackerLabels[writeSource.source],
                      }),
                      htmlFor: 'new-poker-write-back',
                      help: t('Field used for the estimate'),
                      icon: Upload,
                      error:
                          errors.estimate_field_id ?? errors.writes_estimates,
                      control: (
                          <Select
                              value={writeBack}
                              onValueChange={setWriteBack}
                          >
                              <SelectTrigger
                                  id="new-poker-write-back"
                                  size="sm"
                                  aria-label={t('Write estimates to :source', {
                                      source: TrackerLabels[writeSource.source],
                                  })}
                                  className="max-w-56"
                              >
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  {writeBackOptions(writeSource, t).map(
                                      (option) => (
                                          <SelectItem
                                              key={option.value}
                                              value={option.value}
                                          >
                                              {option.label}
                                          </SelectItem>
                                      ),
                                  )}
                              </SelectContent>
                          </Select>
                      ),
                  },
              ]),
    ];

    return (
        <form
            id={context.formId}
            data-slot="poker-session-fields"
            onSubmit={submit}
            className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]"
        >
            <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
                <div className="grid gap-2">
                    <Label htmlFor="new-poker-title">{t('Name')}</Label>
                    <Input
                        id="new-poker-title"
                        value={title}
                        maxLength={120}
                        required
                        autoFocus
                        aria-invalid={errors.title !== undefined || undefined}
                        aria-describedby={
                            errors.title === undefined
                                ? undefined
                                : 'new-poker-title-error'
                        }
                        onChange={(event) => setTitle(event.target.value)}
                    />
                    <FieldError
                        id="new-poker-title-error"
                        message={errors.title}
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    {editing && (
                        <span className="truncate text-sm font-semibold">
                            {t('Deck')}
                        </span>
                    )}
                    {editorDraft === null ? (
                        <DeckPicker
                            variant="compact"
                            value={deckId}
                            onValueChange={setPicked}
                            decks={decks}
                            onCreate={openEditor}
                            onEdit={openEditor}
                        />
                    ) : (
                        <DeckEditor
                            value={editorDraft}
                            onChange={(next) => {
                                setEditorDraft(next);
                                setUnfinishedDeck(false);
                                setErrors(withoutDeckErrors);
                            }}
                            errors={deckErrors}
                            nameRequired={false}
                            saveLabel={t('Use this deck')}
                            idPrefix="deck-custom"
                            onSave={acceptEditorDraft}
                            onCancel={() => {
                                setEditorDraft(null);
                                setUnfinishedDeck(false);
                                setErrors(withoutDeckErrors);
                            }}
                            className="rounded-lg border"
                        />
                    )}
                    {editing && unfinishedDeck && (
                        <FieldError
                            message={t(
                                'This deck needs at least :count values before the game is created.',
                                { count: DeckMinValues },
                            )}
                        />
                    )}
                    <FieldError message={errors.deck} />
                    <FieldError message={errors.saved_deck_id} />
                </div>

                <PokerTasksField
                    value={tasks}
                    onChange={setTasks}
                    error={tasksError(errors)}
                    importError={importError(errors)}
                    importFrom={
                        importSources.length === 0
                            ? undefined
                            : {
                                  workspaceSlug,
                                  teamId: context.team.id,
                                  sources: importSources,
                              }
                    }
                />
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
                {writeSource !== null && (
                    <Alert variant="info" className="flex items-start gap-2">
                        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0 text-body-sm">
                            {t(
                                'Estimates are written to :source when the facilitator clicks “Save estimate”. Unselected tickets stay in the backlog.',
                                { source: TrackerLabels[writeSource.source] },
                            )}
                        </span>
                    </Alert>
                )}
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                        {t('Invitation')}
                    </span>
                    <SettingRow
                        label={t('Allow guests without an account')}
                        htmlFor="new-poker-guests"
                        help={t('Guests join with a nickname, no account')}
                        icon={UserRoundPlus}
                    >
                        <Switch
                            id="new-poker-guests"
                            checked={guests}
                            onCheckedChange={setGuests}
                        />
                    </SettingRow>
                </div>
            </div>

            <SessionFormFooter
                context={context}
                processing={processing}
                disabled={decks.length === 0}
                secondaryAction={secondaryAction}
            />
        </form>
    );
}
