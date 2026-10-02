import { EyeOff, ImageOff, Ungroup } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import RetroHighlightsController from '@/actions/App/Http/Controllers/Retros/RetroHighlightsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import { RetroCard } from '@/components/skrum/retro-card';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifSearchResult } from '@/lib/games/types';
import { CardMaxLength, toCardProps } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf } from '@/lib/retro/board-reducer';
import type {
    BoardCard as BoardCardData,
    CardGif as CardGifPayload,
    CardPayload,
    ColumnColor,
    RetroPhase,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { CardComments } from './card-comments';
import { CardReactions } from './card-reactions';
import { dragIsolation, type CardDragState } from './dnd';
import { GroupName } from './group-name';
import { VoteControls } from './vote-controls';

/** Phases in which a reaction can be added to a card (as `CardReactions` rules). */
const ReactionPhases: RetroPhase[] = ['grouping', 'voting', 'discussing'];

const EditorSelector = '[data-slot="retro-card-input"]';

/** What is typed in the editing field of the card under `root`. */
function editorValue(root: ParentNode | null): string {
    return (
        root?.querySelector<HTMLTextAreaElement>(EditorSelector)?.value ?? ''
    );
}

function typedValue(event: FormEvent<HTMLElement>): string | null {
    const { target } = event;

    return target instanceof HTMLTextAreaElement &&
        target.matches(EditorSelector)
        ? target.value
        : null;
}

export function CardGifDialog({
    gif,
    open,
    onOpenChange,
}: {
    gif: Pick<CardGifPayload, 'url'>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent {...dragIsolation} aria-describedby={undefined}>
                <DialogTitle className="sr-only">{t('GIF')}</DialogTitle>
                <img
                    src={gif.url}
                    alt=""
                    className="h-auto w-full rounded-md"
                />
            </DialogContent>
        </Dialog>
    );
}

/** The GIF of a card outside a `RetroCard`: the presentation overlay, until R9. */
export function CardGif({ gif }: { gif: CardGifPayload }) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className="mb-2 block w-full overflow-hidden rounded-md outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={t('GIF')}
                {...dragIsolation}
                onClick={() => setOpen(true)}
            >
                <img
                    src={gif.previewUrl}
                    alt=""
                    loading="lazy"
                    className="h-auto w-full"
                />
            </button>
            <CardGifDialog gif={gif} open={open} onOpenChange={setOpen} />
        </>
    );
}

/** "GIF" and "Remove GIF" of a card being written, with the search dialog of the retro. */
function GifTools({
    gif,
    onChange,
}: {
    gif: PickedGif | null;
    onChange: (gif: PickedGif | null) => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [picking, setPicking] = useState(false);
    const { retro } = ctx.board;
    const retroId = retro.id;
    const canAttach =
        retro.gifProvider !== null && retro.gifsEnabled && ctx.isEditable;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                RetroGifsController.index(retroId, { query: { q: query } }),
            ),
        [retroId],
    );

    return (
        <>
            {gif && (
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('Remove GIF')}
                    onClick={() => onChange(null)}
                >
                    <ImageOff aria-hidden />
                </Button>
            )}
            {canAttach && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPicking(true)}
                    >
                        <span className="truncate">{t('GIF')}</span>
                    </Button>
                    <GifSearchDialog
                        open={picking}
                        onOpenChange={setPicking}
                        onPick={onChange}
                        search={search}
                        provider={retro.gifProvider}
                        isolation={dragIsolation}
                    />
                </>
            )}
        </>
    );
}

function draftGif(gif: PickedGif | null) {
    return gif ? { previewUrl: gif.previewUrl, url: gif.previewUrl } : null;
}

/**
 * The card being written at the foot of a column. It is always open, so that
 * writing takes one gesture; "Add a card" and N bring the focus to it.
 */
export function CardComposer({
    columnId,
    color,
}: {
    columnId: string;
    color: ColumnColor;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [round, setRound] = useState(0);
    const [gif, setGif] = useState<PickedGif | null>(null);
    const [isBlank, setIsBlank] = useState(true);
    const [sending, setSending] = useState(false);
    const inFlight = useRef(false);

    const reset = () => {
        setGif(null);
        setIsBlank(true);
        setRound((current) => current + 1);
    };

    const submit = async (text: string) => {
        const content = text.trim();

        if (inFlight.current || content.length > CardMaxLength) {
            return;
        }

        if (content === '' && gif === null) {
            return;
        }

        inFlight.current = true;
        setSending(true);

        const response = await ctx.run(
            retroRequest<{ card: CardPayload; writersCount: number }>(
                CardsController.store(ctx.board.retro.id),
                {
                    column_id: columnId,
                    content: content === '' ? null : content,
                    gif_id: gif?.id ?? null,
                },
            ),
        );

        inFlight.current = false;
        setSending(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'cards.upsert', cards: [response.card] });
        ctx.apply({
            type: 'writers.set',
            writersCount: response.writersCount,
        });
        reset();
    };

    return (
        <form
            data-slot="retro-card-composer"
            className="shrink-0"
            onSubmit={(event) => {
                event.preventDefault();
                void submit(editorValue(event.currentTarget));
            }}
            onInput={(event) => {
                const value = typedValue(event);

                if (value !== null) {
                    setIsBlank(value.trim() === '');
                }
            }}
        >
            <RetroCard
                key={round}
                id={`new-${columnId}`}
                domId={`composer-${columnId}`}
                aria-label={t('Add a card')}
                text={null}
                color={color}
                gif={draftGif(gif)}
                editing
                autoFocusEditor={round > 0}
                maxLength={CardMaxLength}
                labels={{ editor: t('Add a card…') }}
                className="not-focus-within:border-(--col-border) not-focus-within:ring-0"
                onEdit={(text) => void submit(text)}
                onEditCancel={reset}
                editorTools={
                    <>
                        <GifTools gif={gif} onChange={setGif} />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={sending || (isBlank && gif === null)}
                        >
                            <span className="truncate">{t('Add')}</span>
                        </Button>
                    </>
                }
            />
        </form>
    );
}

/**
 * The caption of the Writing mockup under a card nobody else can read yet. It
 * takes the last line of the footer: beside the author there is no room left
 * for it once the edit and delete buttons are counted.
 */
function OnlyYouNote() {
    const { t } = useTrans();

    return (
        <span
            data-slot="retro-card-only-you"
            className="order-last flex min-w-0 basis-full items-center justify-end gap-1 text-xs font-bold text-(--col-text)"
        >
            <EyeOff className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t('Visible only to you')}</span>
        </span>
    );
}

export function BoardCard({
    card,
    isChild = false,
    drag,
}: {
    card: BoardCardData;
    isChild?: boolean;
    drag?: CardDragState;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const props = toCardProps(card, ctx.board);
    const { retro, viewer } = ctx.board;
    const { phase } = retro;
    const articleRef = useRef<HTMLElement>(null);
    const [editing, setEditing] = useState(false);
    const [wasEditable, setWasEditable] = useState(props.canEdit);
    const [gif, setGif] = useState<PickedGif | null>(null);
    const [saving, setSaving] = useState(false);
    const [gifOpen, setGifOpen] = useState(false);
    const [removing, setRemoving] = useState(false);
    const removeInFlight = useRef(false);
    const highlightInFlight = useRef(false);
    const saveInFlight = useRef(false);
    /** The editor is open, and nobody closed it on purpose. */
    const editorOpen = useRef(false);
    const typed = useRef('');
    const latest = useRef({
        saved: card.content,
        hasActiveCard: ctx.hasActiveCard,
        warning: '',
    });

    if (wasEditable !== props.canEdit) {
        setWasEditable(props.canEdit);

        if (!props.canEdit) {
            setEditing(false);
        }
    }

    useEffect(() => {
        latest.current = {
            saved: card.content,
            hasActiveCard: ctx.hasActiveCard,
            warning: t('The phase changed before your edit was saved.'),
        };
    });

    const warnIfUnsaved = () => {
        const { saved, warning } = latest.current;

        if (typed.current.trim() !== (saved ?? '').trim()) {
            toast(warning);
        }
    };

    // The phase or the lock took the editor away.
    useEffect(() => {
        if (props.canEdit || !editorOpen.current) {
            return;
        }

        editorOpen.current = false;
        warnIfUnsaved();
    }, [props.canEdit]);

    // The card left the screen with its editor open, and still exists.
    useEffect(
        () => () => {
            if (!editorOpen.current || saveInFlight.current) {
                return;
            }

            if (!latest.current.hasActiveCard(card.id)) {
                return;
            }

            warnIfUnsaved();
        },
        [],
    );

    const startEditing = () => {
        typed.current = card.content ?? '';
        editorOpen.current = true;
        setGif(card.gif);
        setEditing(true);
    };

    const closeEditor = () => {
        editorOpen.current = false;
        setEditing(false);
    };

    const save = async (text: string) => {
        const content = text.trim();

        if (saveInFlight.current || content.length > CardMaxLength) {
            return;
        }

        if (content === '' && gif === null) {
            return;
        }

        saveInFlight.current = true;
        setSaving(true);

        // Without a provider the card's gif is hidden but still stored, so
        // an unchanged gif is left out rather than sent as null.
        const gifChanged = (gif?.id ?? null) !== (card.gif?.id ?? null);

        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(
                CardsController.update({ retro: retro.id, card: card.id }),
                {
                    content: content === '' ? null : content,
                    ...(gifChanged && { gif_id: gif?.id ?? null }),
                },
            ),
        );

        saveInFlight.current = false;
        setSaving(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'cards.upsert', cards: [response.card] });
        closeEditor();
    };

    const remove = async () => {
        if (removeInFlight.current) {
            return;
        }

        removeInFlight.current = true;
        setRemoving(true);

        const result = await ctx
            .run(
                retroRequest(
                    CardsController.destroy({ retro: retro.id, card: card.id }),
                ),
            )
            .finally(() => {
                removeInFlight.current = false;
                setRemoving(false);
            });

        if (result === undefined) {
            return;
        }

        ctx.apply({ type: 'card.remove', cardId: card.id, ungroupedCards: [] });
        // The writers count of the banner comes back with the snapshot.
        await ctx.refetch();
    };

    const toggleHighlight = async () => {
        if (highlightInFlight.current) {
            return;
        }

        highlightInFlight.current = true;

        const response = await ctx.run(
            retroRequest<{ highlightedCardId: string | null }>(
                RetroHighlightsController.update(retro.id),
                { card_id: props.focused ? null : card.id },
            ),
        );

        highlightInFlight.current = false;

        if (response) {
            ctx.apply({
                type: 'highlight.set',
                cardId: response.highlightedCardId,
            });
        }
    };

    const ungroup = async () => {
        const response = await ctx.run(
            retroRequest<{ cards: CardPayload[] }>(
                CardGroupsController.destroy({
                    retro: retro.id,
                    card: card.id,
                }),
            ),
        );

        if (response) {
            ctx.apply({ type: 'cards.upsert', cards: response.cards });
        }
    };

    const isEditing = editing && props.canEdit;
    const groupedCards = isChild ? [] : childrenOf(ctx.board.cards, card.id);
    const showsTotal =
        !isChild &&
        ((phase === 'voting' && card.votes !== null) ||
            phase === 'discussing' ||
            phase === 'completed');
    const showsReactions =
        retro.reactionsEnabled &&
        (card.reactions.length > 0 ||
            (ctx.isEditable && ReactionPhases.includes(phase)));
    const canHighlight =
        !isChild && phase === 'discussing' && viewer.isFacilitator;

    // Votes, reactions, comments and groups keep their old controls here
    // until the task of their phase moves them onto the card's own props.
    const footer: ReactNode = (
        <>
            {card.isMine && phase === 'writing' && <OnlyYouNote />}
            {!isChild && phase === 'voting' && <VoteControls card={card} />}
            {showsTotal && (
                <Badge
                    variant="secondary"
                    aria-label={t(
                        card.votes === 1 ? ':count vote' : ':count votes',
                        { count: card.votes ?? 0 },
                    )}
                >
                    {card.votes ?? 0}
                </Badge>
            )}
            {isChild && phase === 'grouping' && ctx.isEditable && (
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('Ungroup')}
                    onClick={() => void ungroup()}
                >
                    <Ungroup aria-hidden />
                </Button>
            )}
        </>
    );

    return (
        <>
            <RetroCard
                {...props}
                ref={articleRef}
                gif={isEditing ? draftGif(gif) : props.gif}
                editing={isEditing}
                className={cn(
                    isChild && 'border-dashed',
                    // Dimmed, not the dashed ghost: the ghost drops what the
                    // card holds under its text, and the board must not move
                    // under a card that is being dragged.
                    drag?.isDragging && 'opacity-50',
                )}
                footer={footer}
                editorTools={
                    <>
                        <GifTools gif={gif} onChange={setGif} />
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={closeEditor}
                        >
                            <span className="truncate">{t('Cancel')}</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={saving}
                            onClick={() =>
                                void save(editorValue(articleRef.current))
                            }
                        >
                            <span className="truncate">{t('Save')}</span>
                        </Button>
                    </>
                }
                onInput={(event) => {
                    typed.current = typedValue(event) ?? typed.current;
                }}
                {...(isEditing && {
                    onPointerDown: dragIsolation.onPointerDown,
                })}
                onEditStart={startEditing}
                onEditCancel={closeEditor}
                onEdit={(text) => void save(text)}
                onDelete={removing ? undefined : () => void remove()}
                onGifOpen={() => setGifOpen(true)}
                onFocusToggle={
                    canHighlight ? () => void toggleHighlight() : undefined
                }
            >
                {groupedCards.length > 0 && (
                    <div className="order-first">
                        <GroupName card={card} />
                    </div>
                )}
                {showsReactions && <CardReactions card={card} />}
                <CardComments card={card} />
                {groupedCards.map((child) => (
                    <BoardCard key={child.id} card={child} isChild />
                ))}
            </RetroCard>
            {card.gif && !card.hidden && (
                <CardGifDialog
                    gif={card.gif}
                    open={gifOpen}
                    onOpenChange={setGifOpen}
                />
            )}
        </>
    );
}

/** What follows the pointer while a card is dragged; it has no id, the card keeps it. */
export function CardPreview({
    card,
    color,
    width,
}: {
    card: BoardCardData;
    color: ColumnColor;
    width: number | undefined;
}) {
    const { t } = useTrans();

    return (
        <article
            data-slot="retro-card-preview"
            className={cn(width === undefined && 'w-column')}
            style={{ width }}
        >
            <div
                className={cn(
                    columnColorClass(color),
                    'flex -rotate-2 cursor-grabbing flex-col gap-3 rounded-lg border border-(--col-border) bg-(--col) p-3 text-sm/snug text-foreground shadow-drag motion-reduce:rotate-0',
                )}
            >
                {card.hidden ? (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <EyeOff className="size-3.5 shrink-0" aria-hidden />
                        {t('Hidden until the reveal')}
                    </p>
                ) : (
                    <>
                        {card.gif && (
                            <img
                                src={card.gif.previewUrl}
                                alt=""
                                className="h-auto w-full rounded-md"
                            />
                        )}
                        {card.content !== null && (
                            <p className="break-words whitespace-pre-wrap">
                                {card.content}
                            </p>
                        )}
                    </>
                )}
                {card.author && (
                    <p className="truncate text-xs font-medium">
                        {card.author.name}
                    </p>
                )}
            </div>
        </article>
    );
}
