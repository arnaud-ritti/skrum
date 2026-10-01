import {
    Check,
    Crosshair,
    EyeOff,
    Minus,
    Pencil,
    SmilePlus,
    ThumbsUp,
    Trash2,
    VenetianMask,
} from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type ColumnColor =
    | 'sun'
    | 'apricot'
    | 'coral'
    | 'plum'
    | 'iris'
    | 'sky'
    | 'lagoon'
    | 'moss';

export type RetroCardReaction = {
    emoji: string;
    count: number;
    mine: boolean;
};

export type RetroCardProps = {
    id: string;
    text: string;
    color: ColumnColor;
    author?: {
        id: string;
        name: string;
        initials: string;
        presence: AvatarPresence;
    } | null;
    masked?: boolean;
    reactions?: RetroCardReaction[];
    votes?: { total: number | null; mine: number };
    lockedBy?: { name: string; presence: number } | null;
    editing?: boolean;
    selected?: boolean;
    focused?: boolean;
    dragging?: boolean;
    ghost?: boolean;
    canVote?: boolean;
    canEdit?: boolean;
    maxLength?: number;
    quickReactions?: string[];
    onVote?: (delta: 1 | -1) => void;
    onReact?: (emoji: string) => void;
    onEdit?: (text: string) => void;
    onEditStart?: () => void;
    onEditCancel?: () => void;
    onDelete?: () => void;
    className?: string;
};

const columnClasses: Record<ColumnColor, string> = {
    sun: '[--c:var(--skrum-col-sun)] [--c-b:var(--skrum-col-sun-border)] [--c-t:var(--skrum-col-sun-text)]',
    apricot:
        '[--c:var(--skrum-col-apricot)] [--c-b:var(--skrum-col-apricot-border)] [--c-t:var(--skrum-col-apricot-text)]',
    coral: '[--c:var(--skrum-col-coral)] [--c-b:var(--skrum-col-coral-border)] [--c-t:var(--skrum-col-coral-text)]',
    plum: '[--c:var(--skrum-col-plum)] [--c-b:var(--skrum-col-plum-border)] [--c-t:var(--skrum-col-plum-text)]',
    iris: '[--c:var(--skrum-col-iris)] [--c-b:var(--skrum-col-iris-border)] [--c-t:var(--skrum-col-iris-text)]',
    sky: '[--c:var(--skrum-col-sky)] [--c-b:var(--skrum-col-sky-border)] [--c-t:var(--skrum-col-sky-text)]',
    lagoon: '[--c:var(--skrum-col-lagoon)] [--c-b:var(--skrum-col-lagoon-border)] [--c-t:var(--skrum-col-lagoon-text)]',
    moss: '[--c:var(--skrum-col-moss)] [--c-b:var(--skrum-col-moss-border)] [--c-t:var(--skrum-col-moss-text)]',
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

const defaultQuickReactions = ['👍', '🎉', '💡', '❤️', '😂'];

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export function RetroCard({
    id,
    text,
    color,
    author = null,
    masked = false,
    reactions = [],
    votes,
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
    onVote,
    onReact,
    onEdit,
    onEditStart,
    onEditCancel,
    onDelete,
    className,
}: RetroCardProps) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(text);
    const [wasEditing, setWasEditing] = useState(editing);
    const [pickerOpen, setPickerOpen] = useState(false);

    if (editing !== wasEditing) {
        setWasEditing(editing);

        if (editing) {
            setDraft(text);
        }
    }

    const isLocked = lockedBy !== null;
    const isEditing = editing;
    const mineVotes = votes?.mine ?? 0;
    const isAnonymous = author === null;
    const showVoteControls = !masked && votes !== undefined && !ghost;
    const lockPresence = lockedBy?.presence ?? 0;

    const authorLabel = isAnonymous ? t('Anonymous') : author.name;
    const label = masked
        ? t('Card hidden until the reveal')
        : [
              text,
              authorLabel,
              votes && votes.total !== null
                  ? t(':count votes', { count: votes.total })
                  : null,
          ]
              .filter(Boolean)
              .join(', ');

    function submit(): void {
        const content = draft.trim();

        if (isLocked || content === '' || content.length > maxLength) {
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

    const voteButton = showVoteControls && (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    data-slot="retro-card-vote"
                    aria-label={
                        votes.total === null
                            ? t('Vote')
                            : t('Vote, :count votes', { count: votes.total })
                    }
                    aria-pressed={mineVotes > 0}
                    aria-disabled={!canVote || undefined}
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
            </TooltipTrigger>
            <TooltipContent>{`${t('Vote')} (V)`}</TooltipContent>
        </Tooltip>
    );

    return (
        <article
            data-slot="retro-card"
            data-card-id={id}
            data-color={color}
            data-masked={masked || undefined}
            data-locked={isLocked || undefined}
            data-editing={isEditing || undefined}
            data-selected={selected || undefined}
            data-focused={focused || undefined}
            data-dragging={dragging || undefined}
            data-ghost={ghost || undefined}
            tabIndex={ghost ? -1 : 0}
            aria-label={label}
            aria-hidden={ghost || undefined}
            aria-selected={selected || undefined}
            onKeyDown={handleArticleKeyDown}
            className={cn(
                columnClasses[color],
                'group/card @container/card relative flex w-full min-w-0 flex-col gap-3 rounded-lg border border-(--c-b) bg-(--c) p-3 text-foreground shadow-card transition-shadow duration-140 ease-standard outline-none motion-reduce:transition-none',
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
                        'absolute -top-2.5 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
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

            {isEditing ? (
                <textarea
                    data-slot="retro-card-input"
                    aria-label={t('Card text')}
                    autoFocus
                    value={draft}
                    maxLength={maxLength}
                    readOnly={isLocked}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    className="field-sizing-content min-h-16 w-full resize-none bg-transparent text-sm/snug text-foreground outline-none"
                />
            ) : (
                <div className="flex items-start gap-2">
                    {masked ? (
                        <div
                            data-slot="retro-card-masked-text"
                            aria-hidden
                            className="min-w-0 flex-1 rounded-sm bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--c-t)_22%,transparent)_0_0.375rem,transparent_0.375rem_0.75rem)] p-1"
                        >
                            <p className="text-sm/snug break-words blur-sm select-none">
                                {text || '••••• ••••• •••• •••'}
                            </p>
                        </div>
                    ) : (
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
                            className="mt-1.5 flex shrink-0 items-center gap-px text-(--c-t)"
                        >
                            <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                            <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
                        </span>
                    )}
                </div>
            )}

            {!masked && !isEditing && (reactions.length > 0 || onReact) && (
                <div
                    data-slot="retro-card-reactions"
                    className="flex flex-wrap items-center gap-1.5"
                >
                    {reactions.map((reaction) => (
                        <button
                            key={reaction.emoji}
                            type="button"
                            aria-pressed={reaction.mine}
                            aria-label={t(':emoji, :count reactions', {
                                emoji: reaction.emoji,
                                count: reaction.count,
                            })}
                            disabled={!onReact}
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
                    ))}
                    {onReact && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={t('Add a reaction')}
                                        aria-expanded={pickerOpen}
                                        onClick={() =>
                                            setPickerOpen((open) => !open)
                                        }
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
                                quickReactions.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        aria-label={t('React with :emoji', {
                                            emoji,
                                        })}
                                        onClick={() => {
                                            onReact(emoji);
                                            setPickerOpen(false);
                                        }}
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
                    <span
                        data-slot="retro-card-mask-note"
                        className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    >
                        <EyeOff className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                            {t('Hidden until the reveal')}
                        </span>
                    </span>
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
                                className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium"
                            >
                                <PersonAvatar
                                    name={author.name}
                                    presence={author.presence}
                                    size="xs"
                                    decorative
                                />
                                <span className="truncate">
                                    {firstName(author.name)}
                                </span>
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
                        {canEdit && onDelete && !isLocked && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={t('Delete')}
                                        onClick={onDelete}
                                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-focus-within/card:opacity-100 group-hover/card:opacity-100 hover:text-skrum-destructive-text focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Trash2
                                            className="size-4"
                                            aria-hidden
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{`${t('Delete')} (Del)`}</TooltipContent>
                            </Tooltip>
                        )}
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
                                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Minus className="size-4" aria-hidden />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{`${t('Remove a vote')} (Shift+V)`}</TooltipContent>
                            </Tooltip>
                        )}
                        {voteButton}
                    </>
                )}
            </div>
        </article>
    );
}
