import {
    ChevronDown,
    ChevronRight,
    Plus,
    ThumbsUp,
    Unlink,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { RetroCard } from '@/components/skrum/retro-card';
import type {
    ColumnColor,
    RetroCardProps,
} from '@/components/skrum/retro-card';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type CardGroupProps = Omit<
    ComponentProps<'section'>,
    'id' | 'title' | 'color' | 'children'
> & {
    id: string;
    /** DOM id of the section. The old markup had none, so there is no default. */
    domId?: string;
    title: string;
    color: ColumnColor;
    cards: RetroCardProps[];
    collapsed?: boolean;
    editingTitle?: boolean;
    votes?: { total: number | null; mine: number };
    /**
     * The controls of the vote on the whole group (`CardVotes`), on the line
     * "Group vote" under the cards. They say the total themselves, so the
     * line "n votes in total" of an open group is left out.
     */
    voteControls?: ReactNode;
    canEdit?: boolean;
    dropTarget?: boolean;
    titleMaxLength?: number;
    /** Shown under the title (AI name suggestion). */
    titleHint?: ReactNode;
    /**
     * What the title field holds when `editingTitle` opens it: a suggested
     * name the viewer wants to change before keeping it. Saving it unchanged
     * still renames the group.
     */
    titleDraft?: string;
    /**
     * Draws a card of the group in place of the plain `RetroCard`, for a host
     * whose cards hold state of their own. It receives the card as the group
     * would draw it: without shadow, and with "Ungroup" in its footer.
     */
    renderCard?: (card: RetroCardProps, index: number) => ReactNode;
    /** Told when the title field opens and closes, however it was closed. */
    onEditingTitleChange?: (editing: boolean) => void;
    onToggle?: (collapsed: boolean) => void;
    /** `null` clears the name, which the server accepts. */
    onRename?: (title: string | null) => void;
    /** Never offered for the first card: the server cannot ungroup the lead. */
    onUngroup?: (cardId: string) => void;
};

const defaultTitleLength = 40;
const maxStackedAvatars = 3;

function truncate(text: string, length: number): string {
    const clean = text.trim();

    return clean.length > length
        ? `${clean.slice(0, length).trimEnd()}…`
        : clean;
}

export function CardGroup({
    id,
    domId,
    title,
    color,
    cards,
    collapsed,
    editingTitle = false,
    votes,
    voteControls,
    canEdit = false,
    dropTarget = false,
    titleMaxLength = 60,
    titleHint,
    titleDraft,
    renderCard,
    onEditingTitleChange,
    onToggle,
    onRename,
    onUngroup,
    className,
    ...rest
}: CardGroupProps) {
    const { t } = useTrans();
    const titleRef = useRef<HTMLButtonElement>(null);
    const restoreFocus = useRef(false);
    const settled = useRef(true);
    const [isCollapsed, setIsCollapsed] = useState(collapsed ?? false);
    const [seenCollapsed, setSeenCollapsed] = useState(collapsed);
    const [isEditing, setIsEditing] = useState(editingTitle);
    const [seenEditing, setSeenEditing] = useState(editingTitle);
    const [draft, setDraft] = useState(
        editingTitle ? (titleDraft ?? title) : title,
    );

    if (collapsed !== seenCollapsed) {
        setSeenCollapsed(collapsed);

        if (collapsed !== undefined) {
            setIsCollapsed(collapsed);
        }
    }

    if (editingTitle !== seenEditing) {
        setSeenEditing(editingTitle);
        setIsEditing(editingTitle);

        if (editingTitle) {
            setDraft(titleDraft ?? title);
        }
    }

    const firstCard = cards[0];
    const editing = canEdit && isEditing;
    const reportEditing = useRef(onEditingTitleChange);
    const reportedEditing = useRef(editing);

    useEffect(() => {
        reportEditing.current = onEditingTitleChange;
    });

    useEffect(() => {
        if (reportedEditing.current !== editing) {
            reportedEditing.current = editing;
            reportEditing.current?.(editing);
        }

        if (editing) {
            settled.current = false;

            return;
        }

        if (!restoreFocus.current) {
            return;
        }

        restoreFocus.current = false;
        titleRef.current?.focus();
    }, [editing]);

    function readableText(card: RetroCardProps | undefined): string {
        if (!card) {
            return '';
        }

        if (card.masked) {
            return t('Card hidden until the reveal');
        }

        if (card.text !== null && card.text.trim() !== '') {
            return card.text;
        }

        return card.gif ? t('GIF') : '';
    }

    const fallbackTitle = firstCard?.masked
        ? ''
        : truncate(readableText(firstCard), defaultTitleLength);
    const displayTitle =
        title.trim() !== ''
            ? title.trim()
            : fallbackTitle || t('Untitled group');
    const hasTitle = title.trim() !== '';
    const hiddenCards = cards.slice(1);
    const sliceCount = Math.min(hiddenCards.length, 2);
    const authors = cards
        .filter((card) => !card.masked)
        .map((card) => card.author)
        .filter((author) => author != null)
        .filter(
            (author, index, all) =>
                all.findIndex((other) => other.id === author.id) === index,
        );
    const showTotal = votes !== undefined && votes.total !== null;
    const hasVoteControls = voteControls !== undefined && voteControls !== null;

    function toggle(): void {
        const next = !isCollapsed;

        setIsCollapsed(next);
        onToggle?.(next);
    }

    function startEditing(): void {
        if (!canEdit) {
            return;
        }

        setDraft(title.trim() !== '' ? title : '');
        setIsEditing(true);
    }

    function commit(viaKeyboard: boolean): void {
        if (settled.current) {
            return;
        }

        const next = draft.trim();

        settled.current = true;
        restoreFocus.current = viaKeyboard;
        setIsEditing(false);

        if (next === title.trim()) {
            return;
        }

        onRename?.(next === '' ? null : next);
    }

    function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            settled.current = true;
            restoreFocus.current = true;
            setIsEditing(false);

            return;
        }

        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            commit(true);
        }
    }

    function drawCard(card: RetroCardProps, index: number): ReactNode {
        return renderCard ? renderCard(card, index) : <RetroCard {...card} />;
    }

    const toggleLabel = isCollapsed ? t('Expand group') : t('Collapse group');
    const Chevron = isCollapsed ? ChevronRight : ChevronDown;

    const footer = isCollapsed ? (
        <div
            data-slot="card-group-footer"
            className="flex min-w-0 items-center gap-2 px-0.5 text-xs text-muted-foreground"
        >
            {authors.length > 0 && (
                <span className="flex shrink-0 items-center">
                    {authors.slice(0, maxStackedAvatars).map((author) => (
                        <span
                            key={author.id}
                            className="-ml-1 rounded-full ring-2 ring-card first:ml-0"
                        >
                            <PersonAvatar
                                name={author.name}
                                src={author.avatarUrl}
                                presence={author.presence}
                                size="xs"
                                decorative
                            />
                        </span>
                    ))}
                </span>
            )}
            <span className="truncate">
                {[
                    hiddenCards.length > 0
                        ? t(
                              hiddenCards.length === 1
                                  ? '+ :count card'
                                  : '+ :count cards',
                              { count: hiddenCards.length },
                          )
                        : null,
                    showTotal
                        ? t(
                              votes?.total === 1
                                  ? ':count vote'
                                  : ':count votes',
                              { count: votes?.total ?? 0 },
                          )
                        : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
        </div>
    ) : (
        showTotal &&
        !hasVoteControls && (
            <div
                data-slot="card-group-footer"
                className="flex min-w-0 items-center gap-2 px-0.5 text-xs text-muted-foreground"
            >
                <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                    {t(
                        votes?.total === 1
                            ? ':count vote in total'
                            : ':count votes in total',
                        { count: votes?.total ?? 0 },
                    )}
                    {votes.mine > 0 &&
                        ` · ${t(':count of them yours', { count: votes.mine })}`}
                </span>
            </div>
        )
    );

    return (
        <section
            aria-label={t(
                cards.length === 1
                    ? 'Group: :title, :count card'
                    : 'Group: :title, :count cards',
                { title: displayTitle, count: cards.length },
            )}
            {...rest}
            id={domId}
            data-slot="card-group"
            data-group-id={id}
            data-color={color}
            data-collapsed={isCollapsed || undefined}
            data-editing={editing || undefined}
            data-drop-target={dropTarget || undefined}
            className={cn(
                columnColorClass(color),
                '@container/card relative flex w-full min-w-0 flex-col gap-2 rounded-xl border-[1.5px] border-(--col-border) bg-[color-mix(in_oklab,var(--col)_55%,var(--card))] p-3 text-foreground shadow-card transition-shadow duration-140 ease-standard motion-reduce:transition-none',
                dropTarget &&
                    'bg-[color-mix(in_oklab,var(--col)_80%,var(--card))] outline-2 outline-offset-2 outline-(--col-text) outline-dashed',
                className,
            )}
        >
            <header className="flex min-w-0 items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            data-slot="card-group-toggle"
                            aria-expanded={!isCollapsed}
                            aria-label={toggleLabel}
                            onClick={toggle}
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-(--col-text) transition-colors duration-140 ease-standard outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                        >
                            <Chevron className="size-4" aria-hidden />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{toggleLabel}</TooltipContent>
                </Tooltip>

                {editing ? (
                    <input
                        data-slot="card-group-title-input"
                        aria-label={t('Group name')}
                        autoFocus
                        value={draft}
                        maxLength={titleMaxLength}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        onBlur={() => commit(false)}
                        className="h-7 min-w-0 flex-1 rounded-sm bg-card px-1.5 text-sm font-semibold text-foreground ring-2 ring-ring outline-none"
                    />
                ) : canEdit ? (
                    <button
                        ref={titleRef}
                        type="button"
                        data-slot="card-group-title"
                        title={t('Click to rename')}
                        aria-label={hasTitle ? t('Rename group') : undefined}
                        onClick={startEditing}
                        className="-mx-1.5 h-7 min-w-0 flex-1 cursor-text truncate rounded-sm px-1.5 text-left text-sm font-semibold transition-colors duration-140 ease-standard outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    >
                        {displayTitle}
                        {!hasTitle && (
                            <span className="sr-only">
                                {` · ${t('Name this group')}`}
                            </span>
                        )}
                    </button>
                ) : (
                    <span
                        data-slot="card-group-title"
                        className="min-w-0 flex-1 truncate text-sm font-semibold"
                    >
                        {displayTitle}
                    </span>
                )}

                <span
                    data-slot="card-group-count"
                    aria-hidden
                    className="shrink-0 rounded-full border border-(--col-border) bg-card px-2 text-xs/5 font-bold text-(--col-text)"
                >
                    {cards.length}
                </span>
            </header>
            {titleHint !== undefined && titleHint !== null && !editing && (
                <div data-slot="card-group-title-hint" className="min-w-0">
                    {titleHint}
                </div>
            )}

            {isCollapsed ? (
                firstCard && (
                    <div
                        data-slot="card-group-stack"
                        className="relative isolate mb-3"
                    >
                        {drawCard(
                            {
                                ...firstCard,
                                className: cn(
                                    'shadow-none',
                                    firstCard.className,
                                ),
                            },
                            0,
                        )}
                        {sliceCount > 0 && (
                            <div
                                aria-hidden
                                data-slot="card-group-slice"
                                className="absolute inset-0 -z-10 translate-x-1 translate-y-1.5 rotate-1 rounded-lg border border-(--col-border) bg-(--col)"
                            />
                        )}
                        {sliceCount > 1 && (
                            <div
                                aria-hidden
                                data-slot="card-group-slice"
                                className="absolute inset-0 -z-20 translate-x-2 translate-y-3 rotate-2 rounded-lg border border-(--col-border) bg-(--col)"
                            />
                        )}
                        {hiddenCards.length > 0 && (
                            <ul
                                data-slot="card-group-hidden-cards"
                                className="sr-only"
                            >
                                {hiddenCards.map((card) => (
                                    <li key={card.id}>{readableText(card)}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )
            ) : (
                <ul
                    data-slot="card-group-stack"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {cards.map((card, index) => (
                        <li key={card.id} className="min-w-0">
                            {drawCard(
                                {
                                    ...card,
                                    className: cn(
                                        'shadow-none',
                                        card.className,
                                    ),
                                    footer: (
                                        <>
                                            {card.footer}
                                            {canEdit &&
                                                onUngroup &&
                                                index > 0 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                data-slot="card-group-ungroup"
                                                                aria-label={t(
                                                                    'Ungroup',
                                                                )}
                                                                onClick={() =>
                                                                    onUngroup(
                                                                        card.id,
                                                                    )
                                                                }
                                                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                                            >
                                                                <Unlink
                                                                    className="size-4"
                                                                    aria-hidden
                                                                />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {t('Ungroup')}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                        </>
                                    ),
                                },
                                index,
                            )}
                        </li>
                    ))}
                    {dropTarget && (
                        <li
                            data-slot="card-group-drop-slot"
                            className="flex min-h-15 min-w-0 items-start justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-(--col-text) bg-card/55 px-2 pt-2 text-xs font-semibold text-(--col-text)"
                        >
                            <Plus className="size-4 shrink-0" aria-hidden />
                            <span className="min-w-0">
                                {t('Drop to add to the group')}
                            </span>
                        </li>
                    )}
                </ul>
            )}

            {editing && (
                <p
                    data-slot="card-group-title-keys"
                    className="flex min-w-0 flex-wrap items-center gap-x-1 px-0.5 text-xs text-muted-foreground"
                >
                    <kbd className="rounded-xs border border-border bg-card px-1 font-mono">
                        ↵
                    </kbd>
                    {t('save')} ·
                    <kbd className="rounded-xs border border-border bg-card px-1 font-mono">
                        Esc
                    </kbd>
                    {t('cancel')}
                </p>
            )}

            {footer}
            {hasVoteControls && (
                <div
                    data-slot="card-group-votes"
                    className="flex min-w-0 items-center gap-2 px-0.5"
                >
                    <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                        {t('Group vote')}
                    </span>
                    <div className="min-w-0 flex-1">{voteControls}</div>
                </div>
            )}
        </section>
    );
}
