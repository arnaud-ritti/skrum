import { router } from '@inertiajs/react';
import { Copy, Pencil, Plus, Spade } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import WorkspacePokerDecksController from '@/actions/App/Http/Controllers/WorkspacePokerDecksController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { DeckEditor } from '@/components/skrum/deck-editor';
import type { DeckDraft } from '@/components/skrum/deck-editor';
import {
    DeckPreviewStrip,
    deckShapeFromCards,
} from '@/components/skrum/deck-picker';
import { EmptyState } from '@/components/skrum/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    TemplateCard,
    TemplateGridClass,
    TemplatesSection,
} from '@/components/workspaces/template-card';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/delete-visit';
import type { DeleteVisitError } from '@/lib/delete-visit';
import {
    copyDeckName,
    savedDeckPayload,
    serverErrorsToSavedDeckErrors,
} from '@/lib/poker/deck-adapter';
import type { TemplateKind } from '@/lib/workspaces/use-template';
import type { WorkspacePokerDeck, WorkspaceSummary } from '@/types';

type EditorState = {
    /** `null`: a new deck of the workspace. */
    deck: WorkspacePokerDeck | null;
    draft: DeckDraft;
};

const EmptyDraft: DeckDraft = {
    name: '',
    values: [],
    unknownCard: true,
    breakCard: true,
};

/** The decks shared by every team of the workspace (B30). */
export function PokerDecksTab({
    workspace,
    decks,
    allDecks = decks,
    canCreate,
    hrefFor,
}: {
    workspace: WorkspaceSummary;
    /** The decks to show: the ones the search kept. */
    decks: WorkspacePokerDeck[];
    /** Every deck of the workspace: a copy takes a name none of them has. */
    allDecks?: WorkspacePokerDeck[];
    canCreate: boolean;
    hrefFor: (kind: TemplateKind, key: string) => string | null;
}) {
    const { t } = useTrans();
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [errors, setErrors] = useState<{ name?: string; values?: string }>(
        {},
    );
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<WorkspacePokerDeck | null>(null);
    const [deleteError, setDeleteError] = useState<string>();

    const openEditor = (deck: WorkspacePokerDeck | null, draft?: DeckDraft) => {
        setErrors({});
        setEditor({
            deck,
            draft:
                draft ??
                (deck === null
                    ? EmptyDraft
                    : { name: deck.name, ...deckShapeFromCards(deck.cards) }),
        });
    };

    const closeEditor = (): void => {
        if (!saving) {
            setEditor(null);
        }
    };

    const duplicate = (deck: WorkspacePokerDeck): void =>
        openEditor(null, {
            name: copyDeckName(
                t('Copy of :name', { name: deck.name }),
                allDecks.map((item) => item.name),
            ),
            ...deckShapeFromCards(deck.cards),
        });

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
                toast.error(t('Something went wrong. Please try again.'));
                router.reload();

                return false;
            },
        };
        const payload = savedDeckPayload(editor.draft);

        if (editor.deck === null) {
            router.post(
                WorkspacePokerDecksController.store.url(workspace.slug),
                payload,
                options,
            );

            return;
        }

        router.patch(
            WorkspacePokerDecksController.update.url({
                workspace: workspace.slug,
                pokerDeck: editor.deck.id,
            }),
            payload,
            options,
        );
    };

    const remove = (deck: WorkspacePokerDeck): Promise<void> => {
        setDeleteError(undefined);

        return deleteVisit(
            WorkspacePokerDecksController.destroy.url({
                workspace: workspace.slug,
                pokerDeck: deck.id,
            }),
        ).catch((error: DeleteVisitError) => {
            setDeleteError(
                Object.values(error.errors)[0] ??
                    t('Something went wrong. Please try again.'),
            );

            throw error;
        });
    };

    const menuOf = (deck: WorkspacePokerDeck): MenuEntry[] => [
        ...(deck.canManage
            ? [
                  {
                      type: 'item' as const,
                      label: t('Edit'),
                      icon: Pencil,
                      onSelect: () => openEditor(deck),
                  },
              ]
            : []),
        ...(canCreate
            ? [
                  {
                      type: 'item' as const,
                      label: t('Duplicate'),
                      icon: Copy,
                      onSelect: () => duplicate(deck),
                  },
              ]
            : []),
        ...(deck.canManage
            ? [
                  { type: 'separator' as const },
                  {
                      type: 'item' as const,
                      label: t('Delete'),
                      tone: 'danger' as const,
                      onSelect: () => setDeleting(deck),
                  },
              ]
            : []),
    ];

    return (
        <TemplatesSection
            icon={Spade}
            title={t('Planning poker')}
            hint={t('Deck values')}
            actions={
                canCreate && allDecks.length > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full min-w-0"
                        onClick={() => openEditor(null)}
                    >
                        <Plus aria-hidden />
                        <span className="truncate">{t('Create a deck')}</span>
                    </Button>
                ) : undefined
            }
        >
            {allDecks.length === 0 ? (
                <div
                    data-slot="poker-decks-empty"
                    className="rounded-xl border border-dashed border-input bg-card/50"
                >
                    <EmptyState
                        module="poker"
                        headingLevel="h3"
                        title={t('No workspace decks yet.')}
                        description={t(
                            'A deck saved here can be used by every team of the workspace.',
                        )}
                        action={
                            canCreate
                                ? {
                                      label: t('Create a deck'),
                                      icon: Plus,
                                      variant: 'outline',
                                      onClick: () => openEditor(null),
                                  }
                                : undefined
                        }
                    />
                </div>
            ) : (
                <ul
                    aria-label={t('Planning poker')}
                    data-slot="poker-deck-cards"
                    className={TemplateGridClass}
                >
                    {decks.map((deck) => (
                        <li key={deck.id} className="min-w-0">
                            <TemplateCard
                                data-test={`workspace-deck-${deck.id}`}
                                name={deck.name}
                                meta={
                                    deck.usageCount === 1
                                        ? t('1 game')
                                        : t(':count games', {
                                              count: deck.usageCount,
                                          })
                                }
                                preview={
                                    <DeckPreviewStrip
                                        deck={deckShapeFromCards(deck.cards)}
                                        label={t('Values')}
                                        size="sm"
                                        className="flex-1 content-center items-center justify-center"
                                    />
                                }
                                author={deck.author}
                                useHref={hrefFor('poker', deck.id)}
                                menu={menuOf(deck)}
                            />
                        </li>
                    ))}
                </ul>
            )}

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
                        setDeleteError(undefined);
                    }
                }}
                title={t('Delete this deck?')}
                description={t('Games that use it keep their cards.')}
                confirmLabel={t('Delete deck')}
                tone="destructive"
                error={deleteError}
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : remove(deleting)
                }
            />
        </TemplatesSection>
    );
}
