import {
    Check,
    Crosshair,
    Ellipsis,
    EyeOff,
    Frown,
    Meh,
    MessageSquare,
    Minus,
    Pencil,
    Smile,
    SmilePlus,
    ThumbsUp,
    Trash2,
    VenetianMask,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, Ref } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { CardMenu } from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { CardSentiment, ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export type { ColumnColor };

export type RetroCardReaction = {
    emoji: string;
    count: number;
    mine: boolean;
    /** Who reacted; shown in a tooltip. Absent on an anonymous retro. */
    names?: string[];
};

export type RetroCardAuthor = {
    id: string;
    name: string;
    avatarUrl?: string | null;
    presence?: AvatarPresence;
};

export type RetroCardGif = { previewUrl: string; url: string };

export type RetroCardInsight = {
    sentiment?: CardSentiment | null;
    category?: string | null;
};

export type RetroCardProps = Omit<
    ComponentProps<'article'>,
    'id' | 'color' | 'children'
> & {
    id: string;
    /** DOM id of the article. Defaults to `card-{id}`. */
    domId?: string;
    text: string | null;
    color: ColumnColor;
    gif?: RetroCardGif | null;
    author?: RetroCardAuthor | null;
    isMine?: boolean;
    masked?: boolean;
    insight?: RetroCardInsight | null;
    reactions?: RetroCardReaction[];
    votes?: { total: number | null; mine: number };
    commentCount?: number;
    commentsOpen?: boolean;
    lockedBy?: { name: string; presence?: number } | null;
    editing?: boolean;
    selected?: boolean;
    focused?: boolean;
    dragging?: boolean;
    ghost?: boolean;
    canVote?: boolean;
    canEdit?: boolean;
    maxLength?: number;
    quickReactions?: string[];
    menuEntries?: MenuEntry[];
    footer?: ReactNode;
    editorTools?: ReactNode;
    /** Replaces the built-in "Add a reaction" button and quick list (full emoji picker). */
    reactionPicker?: ReactNode;
    /**
     * `voteBlocked` is the reason read next to the vote button when `canVote`
     * is false. `editor` names the editing field ("Card text" by default) and
     * is then its placeholder too.
     */
    labels?: { vote?: string; voteBlocked?: string; editor?: string };
    /** False when the editing field is always shown, as a composer is. */
    autoFocusEditor?: boolean;
    children?: ReactNode;
    onVote?: (delta: 1 | -1) => void;
    onReact?: (emoji: string) => void;
    /** When given, "Add a reaction" calls it instead of opening the quick list. */
    onOpenReactionPicker?: () => void;
    onEdit?: (text: string) => void;
    onEditStart?: () => void;
    onEditCancel?: () => void;
    onDelete?: () => void;
    onGifOpen?: () => void;
    onOpenComments?: () => void;
    onFocusToggle?: () => void;
};

const lockRingClasses: Record<number, string> = {
    1: 'ring-2 ring-skrum-presence-1',
    2: 'ring-2 ring-skrum-presence-2',
    3: 'ring-2 ring-skrum-presence-3',
    4: 'ring-2 ring-skrum-presence-4',
    5: 'ring-2 ring-skrum-presence-5',
    6: 'ring-2 ring-skrum-presence-6',
    7: 'ring-2 ring-skrum-presence-7',
    8: 'ring-2 ring-skrum-presence-8',
    9: 'ring-2 ring-skrum-presence-9',
    10: 'ring-2 ring-skrum-presence-10',
    11: 'ring-2 ring-skrum-presence-11',
    12: 'ring-2 ring-skrum-presence-12',
};

const lockTagClasses: Record<number, string> = {
    1: 'bg-skrum-presence-1 text-skrum-presence-1-foreground',
    2: 'bg-skrum-presence-2 text-skrum-presence-2-foreground',
    3: 'bg-skrum-presence-3 text-skrum-presence-3-foreground',
    4: 'bg-skrum-presence-4 text-skrum-presence-4-foreground',
    5: 'bg-skrum-presence-5 text-skrum-presence-5-foreground',
    6: 'bg-skrum-presence-6 text-skrum-presence-6-foreground',
    7: 'bg-skrum-presence-7 text-skrum-presence-7-foreground',
    8: 'bg-skrum-presence-8 text-skrum-presence-8-foreground',
    9: 'bg-skrum-presence-9 text-skrum-presence-9-foreground',
    10: 'bg-skrum-presence-10 text-skrum-presence-10-foreground',
    11: 'bg-skrum-presence-11 text-skrum-presence-11-foreground',
    12: 'bg-skrum-presence-12 text-skrum-presence-12-foreground',
};

const sentimentIcons = {
    positive: Smile,
    neutral: Meh,
    negative: Frown,
} as const;

const defaultQuickReactions = ['👍', '🎉', '💡', '❤️', '😂'];

const maskPlaceholder = '••••• ••••• •••• •••';

const iconButtonClass =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

const revealOnHoverClass =
    'opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100 pointer-coarse:opacity-100';

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
    if (typeof ref === 'function') {
        ref(value);

        return;
    }

    if (ref) {
        ref.current = value;
    }
}

export function RetroCard({
    id,
    domId,
    text,
    color,
    gif = null,
    author = null,
    isMine = false,
    masked = false,
    insight = null,
    reactions = [],
    votes,
    commentCount,
    commentsOpen,
    lockedBy = null,
    editing = false,
    selected = false,
    focused = false,
    dragging = false,
    ghost = false,
    canVote = false,
    canEdit = false,
    maxLength = 1000,
    quickReactions = defaultQuickReactions,
    menuEntries,
    footer,
    editorTools,
    reactionPicker,
    labels,
    autoFocusEditor = true,
    children,
    onVote,
    onReact,
    onOpenReactionPicker,
    onEdit,
    onEditStart,
    onEditCancel,
    onDelete,
    onGifOpen,
    onOpenComments,
    onFocusToggle,
    className,
    ref,
    onKeyDown,
    ...rest
}: RetroCardProps) {
    const { t } = useTrans();
    const articleRef = useRef<HTMLElement | null>(null);
    const addReactionRef = useRef<HTMLButtonElement>(null);
    const voteButtonRef = useRef<HTMLButtonElement>(null);
    const voteWrapperRef = useRef<HTMLSpanElement>(null);
    const editorHadFocus = useRef(false);
    const [draft, setDraft] = useState(text ?? '');
    const [wasEditing, setWasEditing] = useState(editing);
    const [pickerOpen, setPickerOpen] = useState(false);

    if (editing !== wasEditing) {
        setWasEditing(editing);

        if (editing) {
            setDraft(text ?? '');
        }
    }

    useEffect(() => {
        if (editing || !editorHadFocus.current) {
            return;
        }

        editorHadFocus.current = false;

        const active = document.activeElement;
        const focusWasLost =
            active === null ||
            active === document.body ||
            articleRef.current?.contains(active);

        if (focusWasLost) {
            articleRef.current?.focus();
        }
    }, [editing]);

    /**
     * The press that spends the last vote disables the button it was made on.
     * Focus moves to the wrapper that explains why, or to the card, so the
     * keyboard keeps a place on the card.
     */
    useEffect(() => {
        if (canVote || document.activeElement !== voteButtonRef.current) {
            return;
        }

        if (voteWrapperRef.current?.tabIndex === 0) {
            voteWrapperRef.current.focus();

            return;
        }

        articleRef.current?.focus();
    }, [canVote]);

    const isLocked = lockedBy !== null;
    const isEditing = editing;
    const mineVotes = votes?.mine ?? 0;
    const isAnonymous = author === null;
    const hasGif = gif !== null && !masked;
    const hasText = text !== null && text !== '';
    const showVoteControls = !masked && votes !== undefined && !ghost;
    const lockPresence = lockedBy?.presence ?? 0;
    const sentiment = insight?.sentiment ?? null;
    const category = insight?.category ?? null;
    const showInsight =
        !masked && !isEditing && (sentiment !== null || category !== null);
    const showComments =
        !masked &&
        (onOpenComments !== undefined || (commentCount ?? 0) > 0) &&
        !ghost;
    const hasMenu = menuEntries !== undefined && menuEntries.length > 0;
    const sentimentLabels: Record<CardSentiment, string> = {
        positive: t('Positive'),
        neutral: t('Neutral'),
        negative: t('Negative'),
    };
    const SentimentIcon = sentiment === null ? null : sentimentIcons[sentiment];

    const authorLabel = isAnonymous ? t('Anonymous') : author.name;
    const label = masked
        ? t('Card hidden until the reveal')
        : [
              hasText ? text : null,
              hasGif ? t('GIF') : null,
              authorLabel,
              votes && votes.total !== null
                  ? t(':count votes', { count: votes.total })
                  : null,
          ]
              .filter(Boolean)
              .join(', ');
    const commentsLabel = t('Comments (:count)', { count: commentCount ?? 0 });

    function submit(): void {
        const content = draft.trim();

        if (isLocked || content.length > maxLength) {
            return;
        }

        if (content === '' && gif === null) {
            return;
        }

        onEdit?.(content);
    }

    function vote(delta: 1 | -1): void {
        if (!canVote) {
            return;
        }

        if (delta === -1 && mineVotes <= 0) {
            return;
        }

        onVote?.(delta);
    }

    function handleArticleKeyDown(event: KeyboardEvent<HTMLElement>): void {
        onKeyDown?.(event);

        if (event.defaultPrevented) {
            return;
        }

        if (event.target !== event.currentTarget || isEditing || masked) {
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key === 'Enter' && canEdit && !isLocked) {
            event.preventDefault();
            onEditStart?.();

            return;
        }

        if (event.key === 'Delete' && canEdit && !isLocked) {
            event.preventDefault();
            onDelete?.();

            return;
        }

        if (event.key === 'v' || event.key === 'V') {
            event.preventDefault();
            vote(event.shiftKey ? -1 : 1);
        }
    }

    function handleTextareaKeyDown(
        event: KeyboardEvent<HTMLTextAreaElement>,
    ): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onEditCancel?.();

            return;
        }

        if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
            return;
        }

        if (event.shiftKey && !event.metaKey && !event.ctrlKey) {
            return;
        }

        event.preventDefault();
        submit();
    }

    function pickReaction(emoji: string): void {
        onReact?.(emoji);
        setPickerOpen(false);
        addReactionRef.current?.focus();
    }

    const voteBlockedReason = canVote ? undefined : labels?.voteBlocked;

    const voteButton = showVoteControls && (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    ref={voteWrapperRef}
                    data-slot="retro-card-vote-wrapper"
                    role={voteBlockedReason === undefined ? undefined : 'group'}
                    aria-label={voteBlockedReason}
                    tabIndex={voteBlockedReason === undefined ? undefined : 0}
                    className="inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <button
                        ref={voteButtonRef}
                        type="button"
                        data-slot="retro-card-vote"
                        aria-label={labels?.vote ?? t('Add a vote')}
                        aria-pressed={mineVotes > 0}
                        disabled={!canVote}
                        onClick={() => vote(1)}
                        className={cn(
                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                            mineVotes > 0
                                ? 'border-transparent bg-skrum-primary-soft text-skrum-primary-text'
                                : 'border-input bg-card text-foreground hover:bg-accent',
                            !canVote && 'cursor-not-allowed opacity-60',
                        )}
                    >
                        <ThumbsUp className="size-4" aria-hidden />
                        {votes.total !== null && (
                            <span aria-hidden>{votes.total}</span>
                        )}
                    </button>
                </span>
            </TooltipTrigger>
            {voteBlockedReason === undefined ? (
                <TooltipContent shortcut={['V']}>{t('Vote')}</TooltipContent>
            ) : (
                <TooltipContent>{voteBlockedReason}</TooltipContent>
            )}
        </Tooltip>
    );

    const gifImage = hasGif && (
        <img
            src={gif.previewUrl}
            alt={onGifOpen ? '' : t('GIF')}
            loading="lazy"
            className="h-auto w-full"
        />
    );

    const menu = hasMenu && !ghost && (
        <CardMenu
            label={t('Card options')}
            entries={menuEntries}
            trigger={
                <button
                    type="button"
                    data-slot="retro-card-menu"
                    aria-label={t('Card options')}
                    className={iconButtonClass}
                >
                    <Ellipsis className="size-4" aria-hidden />
                </button>
            }
        />
    );

    return (
        <article
            tabIndex={ghost ? -1 : 0}
            aria-label={label}
            aria-hidden={ghost || undefined}
            aria-selected={selected || undefined}
            {...rest}
            id={domId ?? `card-${id}`}
            ref={(node) => {
                articleRef.current = node;
                assignRef(ref, node);
            }}
            data-slot="retro-card"
            data-card-id={id}
            data-color={color}
            data-mine={isMine || undefined}
            data-masked={masked || undefined}
            data-locked={isLocked || undefined}
            data-editing={isEditing || undefined}
            data-selected={selected || undefined}
            data-focused={focused || undefined}
            data-dragging={dragging || undefined}
            data-ghost={ghost || undefined}
            onKeyDown={handleArticleKeyDown}
            className={cn(
                columnColorClass(color),
                'group/card @container/card relative flex w-full min-w-0 flex-col gap-3 rounded-lg border border-(--col-border) bg-(--col) p-3 text-foreground shadow-card transition-shadow duration-140 ease-standard outline-none motion-reduce:transition-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected && 'ring-2 ring-primary',
                focused && 'ring-2 ring-skrum-info',
                isLocked &&
                    (lockRingClasses[lockPresence] ?? 'ring-2 ring-primary'),
                isEditing &&
                    !isLocked &&
                    'border-ring bg-card ring-2 ring-ring',
                dragging && 'z-70 -rotate-2 cursor-grabbing shadow-drag',
                ghost && 'border-dashed bg-transparent shadow-none *:invisible',
                className,
            )}
        >
            {isLocked && (
                <span
                    data-slot="retro-card-lock"
                    role="status"
                    className={cn(
                        'absolute -top-2.5 right-3 left-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                        lockTagClasses[lockPresence] ??
                            'bg-primary text-primary-foreground',
                    )}
                >
                    <Pencil className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">
                        {t(':name is writing', { name: lockedBy.name })}
                    </span>
                </span>
            )}
            {selected && (
                <span
                    data-slot="retro-card-selected"
                    className="absolute -top-2 -right-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                    <Check className="size-3" aria-hidden />
                    <span className="sr-only">{t('Selected')}</span>
                </span>
            )}

            {showInsight && (
                <div
                    data-slot="retro-card-insight"
                    className="flex min-w-0 items-center gap-1.5 text-(--col-text)"
                >
                    {SentimentIcon && sentiment !== null && (
                        <SentimentIcon
                            role="img"
                            aria-label={sentimentLabels[sentiment]}
                            className="size-3.5 shrink-0"
                        />
                    )}
                    {category !== null && (
                        <span className="min-w-0 truncate rounded-full border border-(--col-border) bg-card px-2 text-xs/5 font-medium">
                            {category}
                        </span>
                    )}
                </div>
            )}

            {hasGif &&
                (onGifOpen && !isEditing ? (
                    <button
                        type="button"
                        data-slot="retro-card-gif"
                        aria-label={t('GIF')}
                        onClick={onGifOpen}
                        className="block w-full overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {gifImage}
                    </button>
                ) : (
                    <div
                        data-slot="retro-card-gif"
                        className="w-full overflow-hidden rounded-md"
                    >
                        {gifImage}
                    </div>
                ))}

            {isEditing ? (
                <textarea
                    data-slot="retro-card-input"
                    aria-label={labels?.editor ?? t('Card text')}
                    placeholder={labels?.editor}
                    autoFocus={autoFocusEditor}
                    value={draft}
                    maxLength={maxLength}
                    readOnly={isLocked}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    onFocus={() => {
                        editorHadFocus.current = true;
                    }}
                    onBlur={() => {
                        editorHadFocus.current = false;
                    }}
                    className="field-sizing-content min-h-16 w-full resize-none bg-transparent text-sm/snug text-foreground outline-none placeholder:text-muted-foreground"
                />
            ) : (
                (masked || hasText || isLocked) && (
                    <div className="flex items-start gap-2">
                        {masked && (
                            <div
                                data-slot="retro-card-masked-text"
                                aria-hidden
                                className="min-w-0 flex-1 rounded-sm bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--col-text)_22%,transparent)_0_0.375rem,transparent_0.375rem_0.75rem)] p-1"
                            >
                                <p className="text-sm/snug break-words blur-sm select-none">
                                    {maskPlaceholder}
                                </p>
                            </div>
                        )}
                        {!masked && (
                            <p
                                data-slot="retro-card-text"
                                className="min-w-0 flex-1 text-sm/snug break-words whitespace-pre-wrap"
                            >
                                {text}
                            </p>
                        )}
                        {isLocked && (
                            <span
                                aria-hidden
                                className="mt-1.5 flex shrink-0 items-center gap-px text-(--col-text)"
                            >
                                <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                                <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
                            </span>
                        )}
                    </div>
                )
            )}

            {!masked &&
                !isEditing &&
                (reactions.length > 0 ||
                    onReact !== undefined ||
                    reactionPicker !== undefined) && (
                    <div
                        data-slot="retro-card-reactions"
                        className="flex flex-wrap items-center gap-1.5"
                    >
                        {reactions.map((reaction) => {
                            const names = reaction.names ?? [];
                            const chip = (
                                <button
                                    key={reaction.emoji}
                                    type="button"
                                    aria-pressed={reaction.mine}
                                    aria-label={
                                        reaction.count === 1
                                            ? t(':emoji, :count reaction', {
                                                  emoji: reaction.emoji,
                                                  count: reaction.count,
                                              })
                                            : t(':emoji, :count reactions', {
                                                  emoji: reaction.emoji,
                                                  count: reaction.count,
                                              })
                                    }
                                    aria-disabled={!onReact || undefined}
                                    onClick={() => onReact?.(reaction.emoji)}
                                    className={cn(
                                        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        reaction.mine
                                            ? 'border-transparent bg-skrum-primary-soft text-skrum-primary-text'
                                            : 'border-input bg-card text-foreground',
                                    )}
                                >
                                    <span aria-hidden>{reaction.emoji}</span>
                                    <span aria-hidden>{reaction.count}</span>
                                </button>
                            );

                            if (names.length === 0) {
                                return chip;
                            }

                            return (
                                <Tooltip key={reaction.emoji}>
                                    <TooltipTrigger asChild>
                                        {chip}
                                    </TooltipTrigger>
                                    <TooltipContent data-slot="retro-card-reaction-names">
                                        {names.join(', ')}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                        {reactionPicker}
                        {onReact && reactionPicker === undefined && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            ref={addReactionRef}
                                            type="button"
                                            aria-label={t('Add a reaction')}
                                            aria-expanded={
                                                onOpenReactionPicker
                                                    ? undefined
                                                    : pickerOpen
                                            }
                                            onClick={() => {
                                                if (onOpenReactionPicker) {
                                                    onOpenReactionPicker();

                                                    return;
                                                }

                                                setPickerOpen((open) => !open);
                                            }}
                                            className="inline-flex h-6 items-center rounded-full border border-dashed border-input bg-card px-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <SmilePlus
                                                className="size-3.5"
                                                aria-hidden
                                            />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {t('Add a reaction')}
                                    </TooltipContent>
                                </Tooltip>
                                {pickerOpen &&
                                    !onOpenReactionPicker &&
                                    quickReactions.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            aria-label={t('React with :emoji', {
                                                emoji,
                                            })}
                                            onClick={() => pickReaction(emoji)}
                                            className="inline-flex h-6 items-center rounded-full border border-input bg-card px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <span aria-hidden>{emoji}</span>
                                        </button>
                                    ))}
                            </>
                        )}
                    </div>
                )}

            <div
                data-slot="retro-card-footer"
                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
            >
                {isEditing && (
                    <>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                            <kbd className="rounded-xs border border-border bg-card px-1 font-mono">
                                ↵
                            </kbd>{' '}
                            {t('publish')} ·{' '}
                            <kbd className="rounded-xs border border-border bg-card px-1 font-mono">
                                Esc
                            </kbd>{' '}
                            {t('cancel')}
                        </span>
                        <span className="grow" />
                        {editorTools}
                        <span
                            data-slot="retro-card-counter"
                            aria-live="polite"
                            className={cn(
                                'text-xs tabular-nums',
                                draft.length >= maxLength
                                    ? 'font-semibold text-skrum-destructive-text'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {`${draft.length}/${maxLength}`}
                        </span>
                    </>
                )}

                {!isEditing && masked && (
                    <>
                        <span
                            data-slot="retro-card-mask-note"
                            className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground"
                        >
                            <EyeOff className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">
                                {t('Hidden until the reveal')}
                            </span>
                        </span>
                        {isMine && (
                            <span
                                data-slot="retro-card-mine"
                                className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                            >
                                {t('You')}
                            </span>
                        )}
                        <span className="grow" />
                        {footer}
                        {menu}
                    </>
                )}

                {!isEditing && !masked && (
                    <>
                        {isAnonymous ? (
                            <span
                                data-slot="retro-card-anonymous"
                                className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                                <VenetianMask
                                    className="size-3.5 shrink-0"
                                    aria-hidden
                                />
                                <span className="truncate">
                                    {t('Anonymous')}
                                </span>
                            </span>
                        ) : (
                            <span
                                data-slot="retro-card-author"
                                title={author.name}
                                className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium"
                            >
                                <PersonAvatar
                                    name={author.name}
                                    src={author.avatarUrl}
                                    presence={author.presence}
                                    size="xs"
                                    decorative
                                />
                                <span className="truncate">
                                    {firstName(author.name)}
                                </span>
                            </span>
                        )}
                        {isMine && (
                            <span
                                data-slot="retro-card-mine"
                                className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                            >
                                {t('You')}
                            </span>
                        )}
                        {focused && (
                            <span
                                data-slot="retro-card-focus-note"
                                className="inline-flex min-w-0 items-center gap-1 rounded-full bg-skrum-info-soft px-2 py-0.5 text-xs font-semibold text-skrum-info-text"
                            >
                                <Crosshair
                                    className="size-3 shrink-0"
                                    aria-hidden
                                />
                                <span className="truncate">
                                    {t('Everyone is looking here')}
                                </span>
                            </span>
                        )}
                        <span className="grow" />
                        {footer}
                        {showComments &&
                            (onOpenComments ? (
                                <button
                                    type="button"
                                    data-slot="retro-card-comments"
                                    aria-label={commentsLabel}
                                    aria-expanded={commentsOpen}
                                    onClick={onOpenComments}
                                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <MessageSquare
                                        className="size-4"
                                        aria-hidden
                                    />
                                    <span aria-hidden>{commentCount ?? 0}</span>
                                </button>
                            ) : (
                                <span
                                    data-slot="retro-card-comments"
                                    role="img"
                                    aria-label={commentsLabel}
                                    className="inline-flex h-8 shrink-0 items-center gap-1 px-2 text-xs font-semibold text-muted-foreground"
                                >
                                    <MessageSquare
                                        className="size-4"
                                        aria-hidden
                                    />
                                    <span aria-hidden>{commentCount}</span>
                                </span>
                            ))}
                        {onFocusToggle && (
                            <button
                                type="button"
                                data-slot="retro-card-discuss"
                                aria-pressed={focused}
                                onClick={onFocusToggle}
                                className={cn(
                                    'inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    focused
                                        ? 'bg-skrum-info-soft text-skrum-info-text'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                )}
                            >
                                <Crosshair
                                    className="size-4 shrink-0"
                                    aria-hidden
                                />
                                <span className="truncate">{t('Discuss')}</span>
                            </button>
                        )}
                        {canEdit && onEditStart && !isLocked && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        data-slot="retro-card-edit"
                                        aria-label={t('Edit card')}
                                        onClick={onEditStart}
                                        className={cn(
                                            iconButtonClass,
                                            revealOnHoverClass,
                                        )}
                                    >
                                        <Pencil
                                            className="size-4"
                                            aria-hidden
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent shortcut={['↵']}>
                                    {t('Edit card')}
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {canEdit && onDelete && !isLocked && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        data-slot="retro-card-delete"
                                        aria-label={t('Delete card')}
                                        onClick={onDelete}
                                        className={cn(
                                            iconButtonClass,
                                            revealOnHoverClass,
                                            'hover:text-skrum-destructive-text',
                                        )}
                                    >
                                        <Trash2
                                            className="size-4"
                                            aria-hidden
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent shortcut={['Del']}>
                                    {t('Delete card')}
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {menu}
                        {mineVotes > 0 && (
                            <span
                                data-slot="retro-card-my-votes"
                                role="img"
                                aria-label={t('Your votes: :count', {
                                    count: mineVotes,
                                })}
                                className="flex min-w-0 flex-wrap items-center gap-1"
                            >
                                {Array.from({ length: mineVotes }, (_, i) => (
                                    <span
                                        key={i}
                                        data-slot="vote-dot"
                                        className="size-2.5 rounded-full border border-primary bg-primary"
                                    />
                                ))}
                            </span>
                        )}
                        {mineVotes > 0 && canVote && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={t('Remove a vote')}
                                        onClick={() => vote(-1)}
                                        className={iconButtonClass}
                                    >
                                        <Minus className="size-4" aria-hidden />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent shortcut={['Shift', 'V']}>
                                    {t('Remove a vote')}
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {voteButton}
                    </>
                )}
            </div>
            {!masked && !ghost && children}
        </article>
    );
}
