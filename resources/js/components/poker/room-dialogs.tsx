import { Link, router } from '@inertiajs/react';
import { Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { toast } from 'sonner';
import PokerSharesController from '@/actions/App/Http/Controllers/Integrations/PokerSharesController';
import PokerFacilitatorsController from '@/actions/App/Http/Controllers/Poker/PokerFacilitatorsController';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
import PokerGuestTokensController from '@/actions/App/Http/Controllers/Poker/PokerGuestTokensController';
import PokerSavedDecksController from '@/actions/App/Http/Controllers/Poker/PokerSavedDecksController';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { DeckEditor } from '@/components/skrum/deck-editor';
import type { DeckDraft } from '@/components/skrum/deck-editor';
import {
    DeckPicker,
    DeckPreviewStrip,
    deckCards,
    deckShapeFromCards,
} from '@/components/skrum/deck-picker';
import { SessionSettingsPopover } from '@/components/skrum/session-settings-popover';
import type {
    SessionSettingGroup,
    SessionSettingsValues,
} from '@/components/skrum/session-settings-popover';
import { ShareDialog } from '@/components/skrum/share-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { enabledShareChannels, hasShareChannel } from '@/lib/integrations';
import {
    CustomDeckId,
    customDeckToPayload,
    deckToPayload,
    serverErrorsToDeckErrors,
    toCustomDeck,
    toDecks,
} from '@/lib/poker/deck-adapter';
import {
    taskTimerChoice,
    taskTimerFromChoice,
    taskTimerOptions,
    writeBackChoice,
    writeBackOptions,
    writeBackPayload,
} from '@/lib/poker/game-options';
import type { WriteBackTarget } from '@/lib/poker/game-options';
import { TrackerLabels, isPokerTrackerSource } from '@/lib/poker/types';
import type { PokerSnapshot, PokerTask } from '@/lib/poker/types';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { joinPageHost } from '@/lib/sessions/join-code';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as savedDecksPage } from '@/routes/teams/pokerDecks';
import type {
    IntegrationDelivery,
    SavedPokerDeck,
    ShareChannel,
} from '@/types';
import { useGame } from './game-context';
import { MarkdownClasses } from './markdown-classes';
import { useSetEnded } from './use-round-actions';

/** The dialogs the facilitator menu and the header open. */
export type RoomDialog = 'share' | 'transfer' | 'end' | 'delete';

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Thrown to keep a dialog open: the reason has already been shown. */
export class Rejected extends Error {}

/** How many times the dialog was opened: a key that gives each opening fresh fields. */
function useOpenings(open: boolean): number {
    const [state, setState] = useState({ open, count: 0 });

    if (state.open !== open) {
        setState({ open, count: open ? state.count + 1 : state.count });
    }

    return state.count;
}

/** A text field of a submitted form; an absent one reads as empty. */
function textOf(data: FormData, name: string): string {
    const value = data.get(name);

    return typeof value === 'string' ? value : '';
}

function FieldError({ message }: { message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p role="alert" className="text-xs text-skrum-destructive-text">
            {message}
        </p>
    );
}

function firstErrors(
    errors: Record<string, string[]>,
): Record<string, string | undefined> {
    return Object.fromEntries(
        Object.entries(errors).map(([key, messages]) => [key, messages[0]]),
    );
}

function emptyDeckDraft(): DeckDraft {
    return { name: '', values: [], unknownCard: true, breakCard: true };
}

function sameCards(first: string[], second: string[]): boolean {
    return (
        first.length === second.length &&
        first.every((card, index) => card === second[index])
    );
}

const SettingKeys = [
    'title',
    'auto_reveal',
    'anonymous_votes',
    'task_timer_seconds',
    'revote_after_reveal',
    'writes_estimates',
    'estimate_field_id',
    'cursors_enabled',
    'reactions_enabled',
];

/** The popover's one "Write estimates" select stands for these two fields. */
const WriteBackKey = 'write_back';

/** The first connected tracker of the room that can take the estimates back. */
function roomWriteBackTarget(
    integrations: PokerSnapshot['integrations'],
): WriteBackTarget | null {
    if (integrations === null) {
        return null;
    }

    for (const [source, connection] of Object.entries(integrations)) {
        if (
            isPokerTrackerSource(source) &&
            connection !== null &&
            connection.connected &&
            connection.canWrite
        ) {
            return {
                source,
                estimateFields: connection.estimateFields,
                defaultEstimateFieldId: connection.defaultEstimateFieldId,
            };
        }
    }

    return null;
}

/** The popover's values as the server takes them. */
function settingsPayload(
    settings: Partial<SessionSettingsValues>,
): Record<string, unknown> {
    const {
        task_timer_seconds: taskTimer,
        [WriteBackKey]: writeBack,
        ...rest
    } = settings;

    return {
        ...rest,
        ...(typeof taskTimer === 'string'
            ? { task_timer_seconds: taskTimerFromChoice(taskTimer) }
            : {}),
        ...(typeof writeBack === 'string' ? writeBackPayload(writeBack) : {}),
    };
}

/** The server's messages, the two write-back fields under their one row. */
function settingsErrors(
    errors: Record<string, string | undefined>,
): Record<string, string | undefined> {
    const writeBack = errors.estimate_field_id ?? errors.writes_estimates;

    return writeBack === undefined
        ? errors
        : { ...errors, [WriteBackKey]: writeBack };
}

/** A message of the server is shown beside its field when the form has one for it. */
function hasFieldFor(key: string): boolean {
    return (
        SettingKeys.includes(key) ||
        key === 'deck' ||
        key === 'saved_deck_id' ||
        key.startsWith('custom_cards')
    );
}

/** The button of the settings: an icon, named by its label and its tooltip. */
function SettingsTrigger({
    className,
    ...props
}: ComponentProps<typeof Button>) {
    const { t } = useTrans();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={t('Game settings')}
                    className={cn('shrink-0', className)}
                    {...props}
                >
                    <Settings2 aria-hidden />
                </Button>
            </TooltipTrigger>
            <TooltipContent shortcut={[',']}>
                {t('Game settings')}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * The settings of the game, in a popover anchored to their button (a drawer on
 * a phone): the name, what a round does, presence, and the deck while nobody
 * has voted. The facilitator applies them in one go; the others read them.
 */
export function GameSettings() {
    const ctx = useGame();
    const { t } = useTrans();
    const { game, me, team, players } = ctx.snapshot;
    const readOnly = !me.isFacilitator;
    const deckLocked = game.hasVotes;
    const canPickDeck = me.isFacilitator && !deckLocked;
    const [isOpen, setIsOpen] = useState(false);
    const open = isOpen && !ctx.sessionExpired;
    const isShown = useRef(open);
    const [draft, setDraft] = useState<Partial<SessionSettingsValues>>({});
    const [errors, setErrors] = useState<Record<string, string | undefined>>(
        {},
    );
    const [error, setError] = useState<string | null>(null);
    const [savedDecks, setSavedDecks] = useState<SavedPokerDeck[]>([]);
    const [typed, setTyped] = useState<{
        token: string;
        deck: DeckDraft;
    } | null>(null);
    const [editorDraft, setEditorDraft] = useState<DeckDraft | null>(null);
    const typedDecks = useRef(new Map<string, DeckDraft>());

    useEffect(() => {
        isShown.current = open;

        return () => {
            isShown.current = false;
        };
    }, [open]);

    useShortcut(',', () => setIsOpen(true), {
        enabled: !open && !ctx.sessionExpired && game.endedAt === null,
    });

    useEffect(() => {
        if (!open || !canPickDeck) {
            return;
        }

        let cancelled = false;

        retroRequest<SavedPokerDeck[]>(PokerSavedDecksController.index(game.id))
            .then((decks) => {
                if (!cancelled) {
                    setSavedDecks(decks ?? []);
                }
            })
            .catch(() => {
                // Built-in and typed decks still work without the list.
            });

        return () => {
            cancelled = true;
        };
    }, [open, canPickDeck, game.id]);

    const reset = (): void => {
        setDraft({});
        setTyped(null);
        setEditorDraft(null);
        setErrors({});
        setError(null);
    };

    const changeOpen = (next: boolean): void => {
        if (!next) {
            reset();
        }

        setIsOpen(next);
    };

    const gameShape = deckShapeFromCards(game.cards);
    const isOwnDeck = game.deck === CustomDeckId;
    const sourceDeck = isOwnDeck
        ? savedDecks.find(
              (deck) =>
                  deck.name === game.deckLabel &&
                  sameCards(deck.cards, game.cards),
          )
        : undefined;
    const gameCustom: DeckDraft | null =
        isOwnDeck && sourceDeck === undefined
            ? { name: '', ...gameShape }
            : null;
    const customDeck = typed?.deck ?? gameCustom;
    const currentToken = isOwnDeck
        ? (sourceDeck?.id ?? CustomDeckId)
        : game.deck;
    const pickedToken =
        typeof draft.deck === 'string' ? draft.deck : currentToken;
    const decks = [
        ...toDecks(ctx.deckOptions, savedDecks).map((deck) => ({
            ...deck,
            canManage: false,
        })),
        ...(customDeck === null
            ? []
            : [toCustomDeck(customDeck, t('Custom deck'))]),
    ];
    const deckErrors = serverErrorsToDeckErrors(errors);

    const pickToken = (token: string): void => {
        const next = { ...draft };

        if (token === currentToken) {
            delete next.deck;
        } else {
            next.deck = token;
        }

        setDraft(next);
    };

    const withoutDeckErrors = (
        current: Record<string, string | undefined>,
    ): Record<string, string | undefined> =>
        Object.fromEntries(
            Object.entries(current).filter(
                ([key]) => !key.startsWith('custom_cards'),
            ),
        );

    const acceptEditorDraft = (): void => {
        if (editorDraft === null) {
            return;
        }

        setEditorDraft(null);

        const isTheGameDeck =
            gameCustom !== null &&
            sameCards(deckCards(editorDraft), deckCards(gameCustom));

        if (isTheGameDeck) {
            setTyped(null);
            pickToken(CustomDeckId);

            return;
        }

        const token = `${CustomDeckId}:${typedDecks.current.size + 1}`;

        typedDecks.current.set(token, editorDraft);
        setTyped({ token, deck: editorDraft });
        pickToken(token);
    };

    const deckPayloadOf = (token: string): Record<string, unknown> => {
        const typedDeck = typedDecks.current.get(token);

        if (typedDeck !== undefined) {
            return customDeckToPayload(typedDeck);
        }

        if (token === CustomDeckId) {
            return gameCustom === null ? {} : customDeckToPayload(gameCustom);
        }

        const deck = decks.find((candidate) => candidate.id === token);

        return deck === undefined ? {} : deckToPayload(deck, null);
    };

    /**
     * Also called by the "Undo" of the confirmation toast, which outlives the
     * popover: once it is closed a refusal is a toast, and nothing is thrown
     * at nobody.
     */
    const apply = async (
        patch: Partial<SessionSettingsValues>,
    ): Promise<void> => {
        const { deck, ...settings } = patch;
        const changes: Record<string, unknown> = {
            ...settingsPayload(settings),
            ...(typeof deck === 'string' ? deckPayloadOf(deck) : {}),
        };

        if (Object.keys(changes).length === 0) {
            return;
        }

        if (isShown.current) {
            setErrors({});
            setError(null);
        }

        try {
            await retroRequest(
                PokerSettingsController.update(game.id),
                changes,
            );
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (!isShown.current) {
                if (message !== null) {
                    toast.error(message);
                }

                return;
            }

            if (message === null) {
                changeOpen(false);

                throw caught;
            }

            const fieldErrors =
                caught instanceof RetroRequestError
                    ? firstErrors(caught.errors)
                    : {};

            setErrors(settingsErrors(fieldErrors));

            if (!Object.keys(fieldErrors).some(hasFieldFor)) {
                setError(message);
            }

            const refused = typeof deck === 'string' ? deck : '';
            const refusedDeck = typedDecks.current.get(refused);

            if (
                refusedDeck !== undefined &&
                serverErrorsToDeckErrors(fieldErrors).values !== undefined
            ) {
                setEditorDraft(refusedDeck);
            }

            throw caught;
        }

        await ctx.refetch();
        setTyped(null);
    };

    const anonymous = draft.anonymous_votes ?? game.anonymousVotes;
    const writeTarget = roomWriteBackTarget(ctx.snapshot.integrations);
    const roundSettings: SessionSettingGroup['settings'] = readOnly
        ? []
        : [
              {
                  type: 'select',
                  key: 'task_timer_seconds',
                  id: 'poker-task-timer',
                  label: t('Timer per task'),
                  help: t('Nudges after the delay'),
                  options: taskTimerOptions(t),
              },
              {
                  type: 'switch',
                  key: 'revote_after_reveal',
                  id: 'poker-revote',
                  label: t('Change vote after reveal'),
                  help: t('Before the estimate is saved'),
              },
              ...(writeTarget === null
                  ? []
                  : [
                        {
                            type: 'select' as const,
                            key: WriteBackKey,
                            id: 'poker-write-back',
                            label: t('Write estimates to :source', {
                                source: TrackerLabels[writeTarget.source],
                            }),
                            help: t('Field used for the estimate'),
                            options: writeBackOptions(writeTarget, t),
                        },
                    ]),
          ];
    const groups: SessionSettingGroup[] = [
        {
            id: 'general',
            label: t('General'),
            settings: [
                {
                    type: 'text',
                    key: 'title',
                    id: 'poker-title',
                    label: t('Title'),
                    maxLength: 120,
                    required: true,
                },
            ],
        },
        {
            id: 'votes',
            label: t('Voting'),
            settings: [
                {
                    type: 'switch',
                    key: 'auto_reveal',
                    id: 'poker-auto-reveal',
                    label: t(
                        'Reveal automatically when everyone has voted or the timer ends',
                    ),
                },
                {
                    type: 'switch',
                    key: 'anonymous_votes',
                    id: 'poker-anonymous-votes',
                    label: t('Anonymous votes'),
                    help: [
                        game.anonymousVotes && anonymous === false
                            ? t('Applies from the next round.')
                            : null,
                        t(
                            "With two voters, each can work out the other's vote from their own.",
                        ),
                    ]
                        .filter((sentence) => sentence !== null)
                        .join(' '),
                },
                ...roundSettings,
            ],
        },
        {
            id: 'presence',
            label: t('Presence'),
            settings: [
                {
                    type: 'switch',
                    key: 'cursors_enabled',
                    id: 'poker-cursors',
                    label: t('Show live cursors'),
                },
                {
                    type: 'switch',
                    key: 'reactions_enabled',
                    id: 'poker-reactions',
                    label: t('Show flying reactions'),
                },
            ],
        },
    ];

    const deckSummary = t(':name, :count cards', {
        name: game.deckLabel,
        count: game.cards.length,
    });

    const facilitator = players.find(
        (player) => player.id === game.facilitatorPlayerId,
    );

    if (game.endedAt !== null) {
        return null;
    }

    return (
        <SessionSettingsPopover
            open={open}
            onOpenChange={changeOpen}
            trigger={<SettingsTrigger />}
            title={t('Game settings')}
            sessionTitle={game.title}
            readOnly={readOnly}
            facilitatorName={facilitator?.name}
            groups={groups}
            value={{
                title: game.title,
                auto_reveal: game.autoReveal,
                anonymous_votes: game.anonymousVotes,
                task_timer_seconds: taskTimerChoice(game.taskTimerSeconds),
                revote_after_reveal: game.revoteAfterReveal,
                ...(writeTarget === null
                    ? {}
                    : {
                          [WriteBackKey]: writeBackChoice(
                              writeTarget,
                              game.writesEstimates,
                              game.estimateFieldId,
                          ),
                      }),
                cursors_enabled: game.cursorsEnabled,
                reactions_enabled: game.reactionsEnabled,
                deck: currentToken,
            }}
            draft={draft}
            onDraftChange={setDraft}
            errors={errors}
            onApply={apply}
            onReset={reset}
        >
            <div
                data-slot="poker-settings-deck"
                className="flex min-w-0 flex-col gap-2"
            >
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate py-1 text-overline text-muted-foreground uppercase">
                        {t('Deck')}
                    </span>
                    {team !== null && (
                        <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="h-auto min-w-0 p-0"
                        >
                            <Link
                                href={
                                    savedDecksPage({
                                        workspace: team.workspace,
                                        team: team.id,
                                    }).url
                                }
                            >
                                <span className="truncate">
                                    {t('Manage decks')}
                                </span>
                            </Link>
                        </Button>
                    )}
                </div>
                {!canPickDeck && (
                    <>
                        <span className="truncate text-xs font-semibold text-muted-foreground">
                            {deckSummary}
                        </span>
                        <DeckPreviewStrip
                            deck={gameShape}
                            label={deckSummary}
                        />
                        {!readOnly && (
                            <p className="text-xs text-muted-foreground">
                                {t("The deck can't change once votes exist.")}
                            </p>
                        )}
                    </>
                )}
                {canPickDeck && editorDraft === null && (
                    <DeckPicker
                        value={
                            pickedToken.startsWith(CustomDeckId)
                                ? CustomDeckId
                                : pickedToken
                        }
                        onValueChange={(id) =>
                            pickToken(
                                id === CustomDeckId
                                    ? (typed?.token ?? CustomDeckId)
                                    : id,
                            )
                        }
                        decks={decks}
                        onCreate={() =>
                            setEditorDraft(customDeck ?? emptyDeckDraft())
                        }
                        onEdit={() =>
                            setEditorDraft(customDeck ?? emptyDeckDraft())
                        }
                    />
                )}
                {canPickDeck && editorDraft !== null && (
                    <DeckEditor
                        value={editorDraft}
                        onChange={(next) => {
                            setEditorDraft(next);
                            setErrors(withoutDeckErrors);
                        }}
                        errors={deckErrors}
                        withoutName
                        saveLabel={t('Use this deck')}
                        idPrefix="deck-custom"
                        onSave={acceptEditorDraft}
                        onCancel={() => {
                            setEditorDraft(null);
                            setErrors(withoutDeckErrors);
                        }}
                        className="rounded-lg border"
                    />
                )}
                <FieldError message={errors.deck} />
                <FieldError message={errors.saved_deck_id} />
                {editorDraft === null && (
                    <FieldError message={deckErrors.values} />
                )}
                <FieldError message={error ?? undefined} />
            </div>
        </SessionSettingsPopover>
    );
}

/** "Share": the guest link and its switch, and the channels the team has connected. */
function ShareGameDialog({ open, onOpenChange }: DialogProps) {
    const ctx = useGame();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const { game, me, share, deliveries } = ctx.snapshot;

    const [confirmingGuestsOff, setConfirmingGuestsOff] = useState(false);
    const isSavingGuests = useRef(false);

    /** One change at a time, so the last switch the user sees is the one the server keeps. */
    const setGuests = async (allowGuests: boolean): Promise<boolean> => {
        if (isSavingGuests.current) {
            return false;
        }

        isSavingGuests.current = true;

        try {
            const result = await ctx.run(
                retroRequest(PokerSettingsController.update(game.id), {
                    guest_access_enabled: allowGuests,
                }),
            );

            if (result === undefined) {
                return false;
            }

            await ctx.refetch();

            return true;
        } finally {
            isSavingGuests.current = false;
        }
    };

    const changeGuests = (allowGuests: boolean): void => {
        const hasGuests =
            ctx.snapshot.players.some((player) => player.isGuest) ||
            ctx.online.some((member) => member.isGuest);

        if (!allowGuests && hasGuests) {
            setConfirmingGuestsOff(true);

            return;
        }

        void setGuests(allowGuests);
    };

    const turnGuestsOff = async (): Promise<void> => {
        if (!(await setGuests(false))) {
            throw new Rejected();
        }
    };

    const regenerate = async (): Promise<void> => {
        const result = await ctx.run(
            retroRequest<{ guestUrl: string; joinCode: string }>(
                PokerGuestTokensController.store(game.id),
            ),
        );

        if (!result) {
            throw new Rejected();
        }

        await ctx.refetch();
    };

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                PokerSharesController.store(game.id),
                { channel, include_guest_link: includeGuestLink },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        toast(t('The message is on its way.'));
        await ctx.refetch();

        return true;
    };

    return (
        <>
            <ShareDialog
                open={open}
                onOpenChange={onOpenChange}
                session={{
                    id: game.id,
                    kind: 'poker',
                    title: game.title,
                    presentCount: ctx.online.length,
                }}
                invite={{
                    url: game.guestUrl,
                    allowGuests: game.guestAccessEnabled,
                    code: game.joinCode ?? undefined,
                    joinUrl: joinPageHost(),
                }}
                canManage={me.isFacilitator && game.endedAt === null}
                onChange={(patch) => {
                    if (patch.allowGuests !== undefined) {
                        changeGuests(patch.allowGuests);
                    }
                }}
                onRegenerate={regenerate}
                channels={enabledShareChannels(share)}
                onShareToChannel={post}
                channelsExtra={
                    hasShareChannel(share) || deliveries.length > 0 ? (
                        <DeliveryLines deliveries={deliveries} />
                    ) : undefined
                }
                isMobile={isMobile}
                guestSwitchId="poker-guest-link-access"
            />
            <ConfirmDialog
                open={confirmingGuestsOff}
                onOpenChange={setConfirmingGuestsOff}
                tone="destructive"
                title={t('Turn off guest access?')}
                description={t('Guests in this game lose access.')}
                confirmLabel={t('Turn off guest access')}
                onConfirm={turnGuestsOff}
            />
        </>
    );
}

/** "Hand over facilitation…": to a member of the team who is in the game. */
function TransferDialog({ open, onOpenChange }: DialogProps) {
    const ctx = useGame();
    const { t } = useTrans();
    const openings = useOpenings(open);
    const [refusal, setRefusal] = useState<number | null>(null);
    const candidates = ctx.snapshot.me.transferCandidates;
    const title = t('Hand over facilitation');

    if (candidates.length === 0) {
        return (
            <FormDialog open={open} onOpenChange={onOpenChange} title={title}>
                <p className="text-sm text-muted-foreground">
                    {t('No one else can facilitate this game yet.')}
                </p>
            </FormDialog>
        );
    }

    const handOver = async (data: FormData): Promise<void> => {
        const userId = textOf(data, 'user_id');

        if (userId === '') {
            setRefusal(openings);

            throw new Rejected();
        }

        setRefusal(null);

        const result = await ctx.run(
            retroRequest(
                PokerFacilitatorsController.update(ctx.snapshot.game.id),
                { user_id: userId },
            ),
        );

        if (result === undefined) {
            throw new Rejected();
        }

        await ctx.refetch();
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            submitLabel={t('Hand over')}
            onSubmit={handOver}
            error={
                refusal === openings
                    ? t('Choose the new facilitator.')
                    : undefined
            }
        >
            <div className="grid gap-2">
                <Label htmlFor="poker-new-facilitator">
                    {t('New facilitator')}
                </Label>
                <Select key={openings} name="user_id">
                    <SelectTrigger id="poker-new-facilitator">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((candidate) => (
                            <SelectItem
                                key={candidate.userId}
                                value={candidate.userId}
                            >
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={candidate.name}
                                    src={candidate.avatarUrl}
                                />
                                <span className="truncate">
                                    {candidate.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </FormDialog>
    );
}

function EndGameDialog({ open, onOpenChange }: DialogProps) {
    const { t } = useTrans();
    const { setEnded } = useSetEnded();

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('End this game?')}
            description={t('It becomes read-only until reopened.')}
            confirmLabel={t('End game')}
            onConfirm={async () => {
                if (!(await setEnded(true))) {
                    throw new Rejected();
                }
            }}
        />
    );
}

function DeleteGameDialog({ open, onOpenChange }: DialogProps) {
    const ctx = useGame();
    const { t } = useTrans();

    const destroy = async (): Promise<void> => {
        const result = await ctx.run(
            retroRequest(PokerGamesController.destroy(ctx.snapshot.game.id)),
        );

        if (result === undefined) {
            throw new Rejected();
        }

        router.visit(ctx.snapshot.links.team ?? dashboard().url);
    };

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            tone="destructive"
            title={t('Delete this game?')}
            description={t(
                'Its tasks, rounds and votes are deleted for everyone.',
            )}
            confirmLabel={t('Delete')}
            onConfirm={destroy}
        />
    );
}

/** The dialogs of the facilitator menu and of "Share". None opens once the session has expired. */
export function RoomDialogs({
    dialog,
    onClose,
}: {
    dialog: RoomDialog | null;
    onClose: () => void;
}) {
    const { sessionExpired } = useGame();
    const open = sessionExpired ? null : dialog;

    const change = (isOpen: boolean): void => {
        if (!isOpen) {
            onClose();
        }
    };

    return (
        <>
            <ShareGameDialog open={open === 'share'} onOpenChange={change} />
            <TransferDialog open={open === 'transfer'} onOpenChange={change} />
            <EndGameDialog open={open === 'end'} onOpenChange={change} />
            <DeleteGameDialog open={open === 'delete'} onOpenChange={change} />
        </>
    );
}

function TaskFields({ task }: { task: PokerTask | null }) {
    const { t } = useTrans();
    const [description, setDescription] = useState(task?.description ?? '');
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    const savedHtml =
        task !== null && (task.description ?? '') === description
            ? task.descriptionHtml
            : '';

    return (
        <>
            <div className="grid gap-2">
                <Label htmlFor="poker-task-title">{t('Title')}</Label>
                <Input
                    id="poker-task-title"
                    name="title"
                    required
                    maxLength={200}
                    autoFocus
                    defaultValue={task?.title ?? ''}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="poker-task-description">
                    {t('Description')}
                </Label>
                <Tabs
                    value={tab}
                    onValueChange={setTab}
                    aria-label={t('Description')}
                    items={[
                        { value: 'write', label: t('Write') },
                        { value: 'preview', label: t('Preview') },
                    ]}
                >
                    <TabsContent
                        value="write"
                        forceMount
                        className="flex flex-col gap-2 data-[state=inactive]:hidden"
                    >
                        <Textarea
                            id="poker-task-description"
                            name="description"
                            rows={8}
                            maxLength={10000}
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Markdown is supported.')}
                        </p>
                    </TabsContent>
                    <TabsContent value="preview">
                        {savedHtml === '' ? (
                            <p className="min-h-24 rounded-md border p-3 text-sm text-muted-foreground">
                                {t('Save to preview')}
                            </p>
                        ) : (
                            <div
                                className={cn(
                                    MarkdownClasses,
                                    'min-h-24 rounded-md border p-3',
                                )}
                                dangerouslySetInnerHTML={{ __html: savedHtml }}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}

/** The full task form: a title and a Markdown description. `task` is null for a new task. */
export function TaskFormDialog({
    task,
    open,
    onOpenChange,
}: DialogProps & { task: PokerTask | null }) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const openings = useOpenings(open);
    const gameId = snapshot.game.id;

    const save = async (data: FormData): Promise<void> => {
        const description = textOf(data, 'description');
        const saved = await run(
            retroRequest<PokerTask>(
                task
                    ? PokerTasksController.update({
                          game: gameId,
                          task: task.id,
                      })
                    : PokerTasksController.store(gameId),
                {
                    title: textOf(data, 'title').trim(),
                    description: description.trim() === '' ? null : description,
                },
            ),
        );

        if (!saved) {
            throw new Rejected();
        }

        apply({ type: 'task.upsert', task: saved });
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={task ? t('Edit task') : t('Add task')}
            submitLabel={t('Save')}
            onSubmit={save}
        >
            <TaskFields key={openings} task={task} />
        </FormDialog>
    );
}

/** "Custom…" of the round timer: a number of minutes, from 1 to 60. */
export function CustomTimerDialog({
    open,
    onOpenChange,
    onStart,
}: DialogProps & {
    /** Resolves to false when the server refused the timer. */
    onStart: (seconds: number) => Promise<boolean>;
}) {
    const { t } = useTrans();
    const [isOutOfRange, setIsOutOfRange] = useState(false);

    const start = async (data: FormData): Promise<void> => {
        const minutes = Number(data.get('minutes'));
        const isInRange =
            Number.isInteger(minutes) && minutes >= 1 && minutes <= 60;

        setIsOutOfRange(!isInRange);

        if (!isInRange || !(await onStart(minutes * 60))) {
            throw new Rejected();
        }
    };

    const change = (isOpen: boolean): void => {
        setIsOutOfRange(false);
        onOpenChange(isOpen);
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={change}
            title={t('Custom minutes')}
            submitLabel={t('Start timer')}
            error={
                isOutOfRange ? t('Choose between 1 and 60 minutes.') : undefined
            }
            onSubmit={start}
        >
            <div className="grid gap-2">
                <Label htmlFor="poker-timer-minutes">{t('Minutes')}</Label>
                <Input
                    id="poker-timer-minutes"
                    name="minutes"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    required
                    defaultValue="5"
                />
            </div>
        </FormDialog>
    );
}
