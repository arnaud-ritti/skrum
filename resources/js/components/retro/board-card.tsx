import { EyeOff, GripVertical, ImageOff, Layers } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusEvent, FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import CardCommentsController from '@/actions/App/Http/Controllers/Retros/CardCommentsController';
import CardReactionsController from '@/actions/App/Http/Controllers/Retros/CardReactionsController';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import RetroHighlightsController from '@/actions/App/Http/Controllers/Retros/RetroHighlightsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import { RetroCard } from '@/components/skrum/retro-card';
import type { RetroCardProps } from '@/components/skrum/retro-card';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useActivity } from '@/hooks/use-retro-activity';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifSearchResult } from '@/lib/games/types';
import {
    cardEngagement,
    CardMaxLength,
    cardVoting,
    toCardProps,
    VoteTotalPhases,
} from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import type {
    BoardCard as BoardCardData,
    CardComment,
    CardGif as CardGifPayload,
    CardPayload,
    ColumnColor,
    ReactionSummary,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { GroupTargetDrawer } from './group-target-drawer';
import { CommentThreadList, type CommentThreadActions } from './comment-thread';
import { dragIsolation, startKeyboardDrag, type CardDragState } from './dnd';
import { useCardVote, useVoteBlockedLabel } from './phase-voting-bar';
import { AddReaction, optimisticReactions } from './reaction-chips';

/**
 * The place a dragged card or group leaves behind: the dashed ghost of the
 * mockup. What the card holds stays mounted, invisible, so that the board
 * does not move under the drag.
 */
export const DraggedCardClass =
    'border-dashed bg-transparent shadow-none *:invisible';

/** A card or a group a dragged card is over: dropping here groups them. */
const DropTargetClass =
    'outline-2 outline-offset-2 outline-(--col-text) outline-dashed';

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

function CardGifDialog({
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

/** The focus left the element for somewhere outside it. */
function leaves(event: FocusEvent<HTMLElement>): boolean {
    const next = event.relatedTarget;

    return !(next instanceof Node && event.currentTarget.contains(next));
}

function draftGif(gif: PickedGif | null) {
    return gif ? { previewUrl: gif.previewUrl, url: gif.previewUrl } : null;
}

/**
 * The card being written, which "Add a card" and N open at the foot of a
 * column. It stays open after a card is published, ready for the next one,
 * until "Cancel" or Esc.
 */
export function CardComposer({
    columnId,
    color,
    autoFocus = false,
    onAdded,
    onCancel,
}: {
    columnId: string;
    color: ColumnColor;
    /** The editor takes the focus as soon as it shows: the composer of a drawer. */
    autoFocus?: boolean;
    onAdded?: () => void;
    onCancel?: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [round, setRound] = useState(0);
    const [gif, setGif] = useState<PickedGif | null>(null);
    const [isBlank, setIsBlank] = useState(true);
    const [sending, setSending] = useState(false);
    const inFlight = useRef(false);
    const { announce, end } = useActivity();

    useEffect(() => () => end('writing', columnId), [end, columnId]);

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
        end('writing', columnId);
        reset();
        onAdded?.();
    };

    const cancel = () => {
        end('writing', columnId);
        reset();
        onCancel?.();
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

                if (value === null) {
                    return;
                }

                setIsBlank(value.trim() === '');

                if (value.trim() === '') {
                    end('writing', columnId);

                    return;
                }

                announce('writing', columnId);
            }}
            onBlur={(event) => {
                if (leaves(event)) {
                    end('writing', columnId);
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
                autoFocusEditor={autoFocus || round > 0}
                maxLength={CardMaxLength}
                labels={{ editor: t('Add a card…') }}
                className="not-focus-within:border-(--col-border) not-focus-within:ring-0"
                onEdit={(text) => void submit(text)}
                onEditCancel={cancel}
                editorTools={
                    <>
                        <GifTools gif={gif} onChange={setGif} />
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancel}
                        >
                            <span className="truncate">{t('Cancel')}</span>
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={sending || (isBlank && gif === null)}
                        >
                            <span className="truncate">{t('Save')}</span>
                        </Button>
                    </>
                }
            />
        </form>
    );
}

/**
 * G on the focused card while grouping: its keyboard move starts, as with
 * Space on its drag handle. One listener for the board, mounted where the
 * drag is set up.
 */
export function useGroupShortcut(): void {
    const ctx = useBoard();

    useShortcut(
        'g',
        (event) => {
            if (!event.repeat) {
                startKeyboardDrag(event.target);
            }
        },
        {
            enabled: ctx.board.retro.phase === 'grouping' && ctx.isEditable,
        },
    );
}

type ReactionsResponse = { cardId: string; reactions: ReactionSummary[] };

/** Adds or takes back the viewer's reaction to a card, shown at once. */
function useCardReactionToggle(card: BoardCardData): (emoji: string) => void {
    const ctx = useBoard();
    const retroId = ctx.board.retro.id;

    return (emoji) => {
        const removing =
            card.reactions.find((reaction) => reaction.emoji === emoji)
                ?.mine === true;
        const route = { retro: retroId, card: card.id };

        ctx.dispatch({
            type: 'reactions.set',
            cardId: card.id,
            reactions: optimisticReactions(card.reactions, emoji, removing),
        });

        void ctx
            .run(
                retroRequest<ReactionsResponse>(
                    removing
                        ? CardReactionsController.destroy(route)
                        : CardReactionsController.update(route),
                    { emoji },
                ),
            )
            .then((response) => {
                if (response) {
                    ctx.apply({
                        type: 'reactions.set',
                        cardId: response.cardId,
                        reactions: response.reactions,
                    });
                }
            });
    };
}

/**
 * Whether the comments of a card are open. Opening them marks them as read,
 * and so does a comment that arrives while they are open.
 */
function useCardComments(card: BoardCardData): {
    open: boolean;
    toggle: () => void;
    isUnread: boolean;
} {
    const { unreadCardIds, markCommentsRead } = useBoard();
    const [open, setOpen] = useState(false);
    const isUnread = unreadCardIds.has(card.id);

    useEffect(() => {
        if (open && isUnread) {
            markCommentsRead(card.id);
        }
    }, [open, isUnread, card.id, markCommentsRead]);

    return { open, toggle: () => setOpen((current) => !current), isUnread };
}

function UnreadCommentsDot() {
    const { t } = useTrans();

    return (
        <span
            role="img"
            data-slot="retro-card-unread"
            aria-label={t('Unread comments')}
            className="size-2 shrink-0 rounded-full bg-primary"
        />
    );
}

/** The comments of a card, and the fields to write one when the phase allows. */
function CardThread({
    card,
    canWrite,
}: {
    card: BoardCardData;
    canWrite: boolean;
}) {
    const ctx = useBoard();
    const retroId = ctx.board.retro.id;

    const save = async (
        request: Promise<{ comment: CardComment }>,
    ): Promise<boolean> => {
        const response = await ctx.run(request);

        if (!response) {
            return false;
        }

        ctx.apply({ type: 'comment.upsert', comment: response.comment });

        return true;
    };

    const actions: CommentThreadActions<CardComment> = {
        create: (content, parentCommentId) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.store({
                        retro: retroId,
                        card: card.id,
                    }),
                    { content, parentCommentId },
                ),
            ),
        update: (comment, content) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.update({
                        retro: retroId,
                        comment: comment.id,
                    }),
                    { content },
                ),
            ),
        remove: async (comment, hasReplies) => {
            const result = await ctx.run(
                retroRequest(
                    CardCommentsController.destroy({
                        retro: retroId,
                        comment: comment.id,
                    }),
                ),
            );

            if (result === undefined) {
                return;
            }

            ctx.apply({
                type: 'comment.remove',
                cardId: comment.cardId,
                commentId: comment.id,
                soft: comment.parentCommentId === null && hasReplies,
            });

            if (comment.parentCommentId === null) {
                return;
            }

            const thread = card.comments.find(
                (candidate) => candidate.id === comment.parentCommentId,
            );

            if (thread?.deleted && thread.replies.length === 1) {
                ctx.apply({
                    type: 'comment.remove',
                    cardId: comment.cardId,
                    commentId: thread.id,
                    soft: false,
                });
            }
        },
    };

    return (
        <div {...dragIsolation} data-slot="retro-card-thread">
            <CommentThreadList
                threads={card.comments}
                canWrite={canWrite}
                actions={actions}
            />
        </div>
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
    drag,
    inGroup,
}: {
    card: BoardCardData;
    drag?: CardDragState;
    /** What the group adds to a card it holds: no shadow, and "Ungroup". */
    inGroup?: Pick<RetroCardProps, 'className' | 'footer'>;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const props = toCardProps(card, ctx.board);
    const engagement = cardEngagement(card, ctx.board);
    const toggleReaction = useCardReactionToggle(card);
    const comments = useCardComments(card);
    const vote = useCardVote(card);
    const voteBlockedLabel = useVoteBlockedLabel();
    // The vote of a group is on the line of the group, not on its cards.
    const voting = inGroup ? null : cardVoting(card, ctx.board);
    const isChild = card.parentCardId !== null;
    const { retro, viewer } = ctx.board;
    const { phase } = retro;
    const articleRef = useRef<HTMLElement>(null);
    const isMobile = useIsMobile();
    const [choosingGroup, setChoosingGroup] = useState(false);
    // On a phone a card is not dragged onto another: its menu groups it.
    const offersGrouping =
        isMobile &&
        phase === 'grouping' &&
        ctx.isEditable &&
        !inGroup &&
        !isChild &&
        !card.hidden;
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
    /** The column this card's editor announced writing in, if it did. */
    const announcedIn = useRef<string | null>(null);
    const { announce, end } = useActivity();
    const writesIn = phase === 'writing' ? card.columnId : null;
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

    const endWriting = () => {
        const column = announcedIn.current;

        if (column === null) {
            return;
        }

        announcedIn.current = null;
        end('writing', column);
    };

    // Only the card whose editor announced ends it: another card leaving
    // the column must not end the viewer's typing elsewhere.
    useEffect(() => {
        if (writesIn === null) {
            return;
        }

        return () => {
            const column = announcedIn.current;

            if (column === null) {
                return;
            }

            announcedIn.current = null;
            end('writing', column);
        };
    }, [end, writesIn]);

    const closeEditor = () => {
        endWriting();

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

    const isEditing = editing && props.canEdit;
    const showsTotal = !isChild && VoteTotalPhases.includes(phase);
    const votingTotal = voting?.votes.total ?? null;
    const canHighlight =
        !isChild && phase === 'discussing' && viewer.isFacilitator;

    const canDrag =
        drag !== undefined && phase === 'grouping' && ctx.isEditable;

    const footer: ReactNode = (
        <>
            {card.isMine && phase === 'writing' && <OnlyYouNote />}
            {votingTotal !== null && (
                <span
                    role="img"
                    data-slot="retro-card-vote-total"
                    className="sr-only"
                    aria-label={t(
                        votingTotal === 1 ? ':count vote' : ':count votes',
                        { count: votingTotal },
                    )}
                />
            )}
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
            {comments.isUnread && engagement.showsComments && (
                <UnreadCommentsDot />
            )}
            {canDrag && (
                <GripVertical
                    data-slot="retro-card-grip"
                    className="size-4 shrink-0 text-muted-foreground opacity-60"
                    aria-hidden
                />
            )}
            {inGroup?.footer}
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
                    inGroup?.className,
                    drag?.isDragging && DraggedCardClass,
                    drag?.isDropTarget && DropTargetClass,
                )}
                reactions={engagement.reactions}
                onReact={engagement.canReact ? toggleReaction : undefined}
                reactionPicker={
                    engagement.canReact ? (
                        <AddReaction onPick={toggleReaction} />
                    ) : undefined
                }
                {...(voting && {
                    votes: voting.votes,
                    canVote: voting.canVote,
                    canUnvote: voting.canUnvote,
                    labels: { voteBlocked: voteBlockedLabel(voting) },
                    onVote: vote,
                })}
                commentCount={card.commentCount}
                commentsOpen={
                    engagement.showsComments ? comments.open : undefined
                }
                onOpenComments={
                    engagement.showsComments ? comments.toggle : undefined
                }
                footer={footer}
                menuEntries={
                    offersGrouping
                        ? [
                              {
                                  type: 'item',
                                  label: t('Add to group…'),
                                  icon: Layers,
                                  onSelect: () => setChoosingGroup(true),
                              },
                          ]
                        : undefined
                }
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
                    const value = typedValue(event);

                    if (value === null) {
                        return;
                    }

                    typed.current = value;

                    if (writesIn !== null && value.trim() !== '') {
                        announcedIn.current = writesIn;
                        announce('writing', writesIn);
                    }
                }}
                onBlur={(event) => {
                    if (writesIn !== null && isEditing && leaves(event)) {
                        endWriting();
                    }
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
                {comments.open && engagement.showsComments && (
                    <CardThread card={card} canWrite={engagement.canComment} />
                )}
            </RetroCard>
            {card.gif && !card.hidden && (
                <CardGifDialog
                    gif={card.gif}
                    open={gifOpen}
                    onOpenChange={setGifOpen}
                />
            )}
            {offersGrouping && (
                <GroupTargetDrawer
                    card={card}
                    open={choosingGroup}
                    onOpenChange={setChoosingGroup}
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
