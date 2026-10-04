import { Link, router } from '@inertiajs/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import PokerDeckDuplicatesController from '@/actions/App/Http/Controllers/PokerDeckDuplicatesController';
import PokerDecksController from '@/actions/App/Http/Controllers/PokerDecksController';
import TeamDefaultPokerDecksController from '@/actions/App/Http/Controllers/TeamDefaultPokerDecksController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspacePokerDecksController from '@/actions/App/Http/Controllers/WorkspacePokerDecksController';
import { DeckCard } from '@/components/poker/deck-card';
import type { DeckCardModel } from '@/components/poker/deck-card';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { DeckEditor } from '@/components/skrum/deck-editor';
import type { DeckDraft } from '@/components/skrum/deck-editor';
import { deckShapeFromCards } from '@/components/skrum/deck-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import {
    copyDeckName,
    savedDeckPayload,
    serverErrorsToSavedDeckErrors,
} from '@/lib/poker/deck-adapter';
import type {
    BuiltInDeckSummary,
    SavedDeckSummary,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

export type SavedDecksPageProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    builtInDecks: BuiltInDeckSummary[];
    savedDecks: SavedDeckSummary[];
    canCreate: boolean;
    canSetDefault: boolean;
    deckLimit: number;
};

type EditorState = {
    /** `null`: a new deck of the team. */
    deck: SavedDeckSummary | null;
    draft: DeckDraft;
};

const EmptyDraft: DeckDraft = {
    name: '',
    values: [],
    unknownCard: true,
    breakCard: true,
};

function builtInModel(deck: BuiltInDeckSummary): DeckCardModel {
    return {
        id: deck.key,
        name: deck.name,
        cards: deck.cards,
        kind: 'builtin',
        isDefault: deck.isDefault,
        usageCount: deck.usageCount,
    };
}

function savedModel(deck: SavedDeckSummary): DeckCardModel {
    return {
        id: deck.id,
        name: deck.name,
        cards: deck.cards,
        kind: deck.scope,
        isDefault: deck.isDefault,
        usageCount: deck.usageCount,
        createdBy: deck.createdBy,
    };
}

export function SavedDecksPage({
    workspace,
    team,
    builtInDecks,
    savedDecks,
    canCreate,
    canSetDefault,
    deckLimit,
}: SavedDecksPageProps) {
    const { t } = useTrans();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const deletedIdRef = useRef<string | null>(null);
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [errors, setErrors] = useState<{ name?: string; values?: string }>(
        {},
    );
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<SavedDeckSummary | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const params = { workspace: workspace.slug, team: team.id };
    const teamDecks = savedDecks.filter((deck) => deck.scope === 'team');
    const full = teamDecks.length >= deckLimit;
    const canAdd = canCreate && !full;

    useEffect(() => {
        const deletedId = deletedIdRef.current;

        if (deletedId === null || deleting !== null) {
            return;
        }

        if (savedDecks.some((deck) => deck.id === deletedId)) {
            return;
        }

        deletedIdRef.current = null;
        headingRef.current?.focus();
    }, [savedDecks, deleting]);

    const reload = (): void => {
        router.reload();
    };

    const failed = (): void => {
        toast.error(t('Something went wrong. Please try again.'));
        reload();
    };

    const openEditor = (deck: SavedDeckSummary | null): void => {
        setErrors({});
        setEditor({
            deck,
            draft:
                deck === null
                    ? EmptyDraft
                    : { name: deck.name, ...deckShapeFromCards(deck.cards) },
        });
    };

    const closeEditor = (): void => {
        if (!saving) {
            setEditor(null);
        }
    };

    const save = (): void => {
        if (editor === null) {
            return;
        }

        const options = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => setEditor(null),
            onError: (failed: Record<string, string>) =>
                setErrors(serverErrorsToSavedDeckErrors(failed)),
            onHttpException: () => {
                setEditor(null);
                failed();

                return false;
            },
        };
        const payload = savedDeckPayload(editor.draft);

        if (editor.deck === null) {
            router.post(
                PokerDecksController.store(params).url,
                payload,
                options,
            );

            return;
        }

        router.patch(
            editor.deck.scope === 'workspace'
                ? WorkspacePokerDecksController.update({
                      workspace: workspace.slug,
                      pokerDeck: editor.deck.id,
                  }).url
                : PokerDecksController.update({
                      ...params,
                      pokerDeck: editor.deck.id,
                  }).url,
            payload,
            options,
        );
    };

    const remove = (deck: SavedDeckSummary): Promise<void> =>
        new Promise((resolve) => {
            deletedIdRef.current = deck.id;

            router.delete(
                deck.scope === 'workspace'
                    ? WorkspacePokerDecksController.destroy({
                          workspace: workspace.slug,
                          pokerDeck: deck.id,
                      }).url
                    : PokerDecksController.destroy({
                          ...params,
                          pokerDeck: deck.id,
                      }).url,
                {
                    preserveScroll: true,
                    onError: (refused: Record<string, string>) => {
                        deletedIdRef.current = null;
                        toast.error(
                            Object.values(refused)[0] ??
                                t('Something went wrong. Please try again.'),
                        );
                    },
                    onHttpException: () => {
                        deletedIdRef.current = null;
                        failed();

                        return false;
                    },
                    onFinish: () => {
                        setDeleting(null);
                        resolve();
                    },
                },
            );
        });

    const actionOptions = (id: string, success?: string) => ({
        preserveScroll: true,
        onStart: () => setBusyId(id),
        onFinish: () => setBusyId(null),
        onSuccess: () => {
            if (success !== undefined) {
                toast.success(success);
            }
        },
        onError: (failed: Record<string, string>) => {
            toast.error(
                Object.values(failed)[0] ??
                    t('Something went wrong. Please try again.'),
            );
        },
        onHttpException: () => {
            failed();

            return false;
        },
    });

    /**
     * A deck of the team is copied by the server. A built-in deck and a deck
     * of the workspace have no row of the team to copy: their cards are
     * posted as a new deck of the team.
     */
    const duplicate = (deck: DeckCardModel): void => {
        const options = actionOptions(deck.id, t('Deck duplicated.'));

        if (deck.kind === 'team') {
            router.post(
                PokerDeckDuplicatesController.store({
                    ...params,
                    pokerDeck: deck.id,
                }).url,
                {},
                options,
            );

            return;
        }

        router.post(
            PokerDecksController.store(params).url,
            savedDeckPayload({
                name: copyDeckName(
                    t('Copy of :name', { name: deck.name }),
                    teamDecks.map((teamDeck) => teamDeck.name),
                ),
                ...deckShapeFromCards(deck.cards),
            }),
            options,
        );
    };

    const setDefault = (deck: DeckCardModel): void => {
        router.put(
            TeamDefaultPokerDecksController.update(params).url,
            deck.kind === 'builtin'
                ? { deck: deck.id }
                : { saved_deck_id: deck.id },
            actionOptions(deck.id),
        );
    };

    const cardActions = (model: DeckCardModel) => ({
        busy: busyId === model.id,
        onDuplicate: canAdd ? () => duplicate(model) : undefined,
        onSetDefault: canSetDefault ? () => setDefault(model) : undefined,
    });

    return (
        <div
            data-slot="saved-decks-page"
            className="flex min-w-0 flex-col gap-5"
        >
            <Link
                href={TeamsController.show(params)}
                className="flex max-w-full items-center gap-2 self-start rounded-sm text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <ArrowLeft aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{t('Back to the team')}</span>
            </Link>

            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="rounded-sm font-display text-2xl font-bold tracking-heading outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        {t('Saved decks')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Shared by every game of the team')}
                    </p>
                </div>
                {canAdd ? (
                    <Button
                        type="button"
                        size="sm"
                        className="max-w-full min-w-0"
                        onClick={() => openEditor(null)}
                    >
                        <Plus aria-hidden="true" />
                        <span className="truncate">{t('New deck')}</span>
                    </Button>
                ) : null}
            </div>

            {canCreate && full ? (
                <p
                    role="status"
                    data-slot="saved-decks-limit"
                    className="text-body-sm text-muted-foreground"
                >
                    {t('This team already has :count saved decks.', {
                        count: deckLimit,
                    })}
                </p>
            ) : null}

            <ul
                aria-label={t('Saved decks')}
                data-slot="saved-decks-grid"
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(60)),1fr))] gap-3"
            >
                {builtInDecks.map((deck) => {
                    const model = builtInModel(deck);

                    return (
                        <li key={model.id} className="min-w-0">
                            <DeckCard deck={model} {...cardActions(model)} />
                        </li>
                    );
                })}
                {savedDecks.map((deck) => {
                    const model = savedModel(deck);

                    return (
                        <li key={model.id} className="min-w-0">
                            <DeckCard
                                deck={model}
                                {...cardActions(model)}
                                onEdit={
                                    deck.canManage
                                        ? () => openEditor(deck)
                                        : undefined
                                }
                                onDelete={
                                    deck.canManage
                                        ? () => setDeleting(deck)
                                        : undefined
                                }
                            />
                        </li>
                    );
                })}
                {canAdd ? (
                    <li className="min-w-0">
                        <button
                            type="button"
                            data-slot="deck-create"
                            onClick={() => openEditor(null)}
                            className="flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input p-5 text-center text-muted-foreground transition-colors duration-140 ease-standard outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                        >
                            <Plus aria-hidden="true" className="size-6" />
                            <span className="text-sm font-semibold text-foreground">
                                {t('Create a custom deck')}
                            </span>
                            {savedDecks.length === 0 ? (
                                <span className="text-xs">
                                    {t('No saved decks yet.')}
                                </span>
                            ) : null}
                            <span className="text-xs">
                                {t('Any values, emoji allowed')}
                            </span>
                        </button>
                    </li>
                ) : null}
            </ul>

            {!canAdd && savedDecks.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">
                    {t('No saved decks yet.')}
                </p>
            ) : null}

            <Dialog
                open={editor !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        closeEditor();
                    }
                }}
            >
                <DialogContent
                    aria-describedby={undefined}
                    className="gap-0 p-0 sm:max-w-4xl"
                >
                    <DialogTitle className="px-5 pt-5 pr-14">
                        {editor?.deck
                            ? t('Edit :name', { name: editor.deck.name })
                            : t('Create a deck')}
                    </DialogTitle>
                    {editor !== null ? (
                        <DeckEditor
                            value={editor.draft}
                            onChange={(draft) => {
                                setEditor({ ...editor, draft });
                                setErrors({});
                            }}
                            errors={errors}
                            saving={saving}
                            saveLabel={t('Save')}
                            idPrefix={
                                editor.deck
                                    ? `deck-${editor.deck.id}`
                                    : 'deck-new'
                            }
                            onSave={save}
                            onCancel={closeEditor}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleting(null);
                    }
                }}
                title={t('Delete this deck?')}
                description={t('Games that use it keep their cards.')}
                confirmLabel={t('Delete deck')}
                tone="destructive"
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : remove(deleting)
                }
            />
        </div>
    );
}
