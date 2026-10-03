import { Combine, Layers, Sparkles, Users } from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useState,
    type PointerEvent,
    type ReactNode,
} from 'react';
import { toast } from 'sonner';
import CardGroupNamesController from '@/actions/App/Http/Controllers/Retros/CardGroupNamesController';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import GroupNameSuggestionsController from '@/actions/App/Http/Controllers/Retros/GroupNameSuggestionsController';
import { CardGroup } from '@/components/skrum/card-group';
import { CardVotes } from '@/components/skrum/vote-dots';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import {
    cardVoting,
    GroupNamingPhases,
    groupingProgress,
    toGroupProps,
} from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import type {
    BoardCard as BoardCardData,
    CardPayload,
} from '@/lib/retro/types';
import { BoardCard, DraggedCardClass } from './board-card';
import { useBoard } from './board-context';
import type { CardDragState } from './dnd';
import { useCardVote, useVoteBlockedLabel } from './phase-voting-bar';

type GroupNameResponse = { cardId: string; groupName: string | null };

type GroupNameSuggestionsValue = {
    suggestions: Record<string, string>;
    busy: boolean;
    request: () => Promise<void>;
    dismiss: (cardId: string) => void;
};

const GroupNameSuggestionsContext =
    createContext<GroupNameSuggestionsValue | null>(null);

/**
 * Suggestions are only kept in the requester's browser: nothing is saved
 * or broadcast until a name is accepted.
 */
export function GroupNameSuggestionsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [suggestions, setSuggestions] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const { run } = ctx;
    const retroId = ctx.board.retro.id;

    const request = useCallback(async () => {
        setBusy(true);
        const response = await run(
            retroRequest<{
                suggestions: Array<{ cardId: string; name: string }>;
            }>(GroupNameSuggestionsController.store(retroId)),
        );
        setBusy(false);

        if (!response) {
            return;
        }

        if (response.suggestions.length === 0) {
            toast(t('No new names to suggest.'));

            return;
        }

        setSuggestions((current) => ({
            ...current,
            ...Object.fromEntries(
                response.suggestions.map((suggestion) => [
                    suggestion.cardId,
                    suggestion.name,
                ]),
            ),
        }));
    }, [run, retroId, t]);

    const dismiss = useCallback((cardId: string) => {
        setSuggestions((current) => {
            const next = { ...current };

            delete next[cardId];

            return next;
        });
    }, []);

    return (
        <GroupNameSuggestionsContext
            value={{ suggestions, busy, request, dismiss }}
        >
            {children}
        </GroupNameSuggestionsContext>
    );
}

/**
 * "Suggest group names", with where the cards are sent. Anyone may ask, as
 * long as a group has no name.
 */
export function SuggestGroupNames() {
    const ctx = useBoard();
    const { t } = useTrans();
    const value = useContext(GroupNameSuggestionsContext);
    const { features, retro, cards } = ctx.board;
    const hasUnnamedGroups = cards.some(
        (card) =>
            card.parentCardId === null &&
            card.groupName === null &&
            cards.some((child) => child.parentCardId === card.id),
    );

    if (
        !value ||
        !features.llm ||
        !retro.aiSummaryEnabled ||
        !GroupNamingPhases.includes(retro.phase) ||
        !ctx.isEditable ||
        !hasUnnamedGroups
    ) {
        return null;
    }

    return (
        <div
            role="region"
            aria-label={t('Suggest group names')}
            data-slot="retro-group-name-suggestions"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-popover py-2 pr-2 pl-3 text-body-sm shadow-card"
        >
            <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-md bg-skrum-primary-soft text-skrum-primary-text"
            >
                <Sparkles className="size-4" />
            </span>
            <p className="min-w-48 flex-1 text-muted-foreground">
                {t('Card contents of these groups are sent to :provider.', {
                    provider: features.llmProvider ?? '',
                })}
            </p>
            <Button
                type="button"
                size="sm"
                variant="secondary"
                className="max-w-full"
                disabled={value.busy}
                onClick={() => void value.request()}
            >
                <Sparkles aria-hidden />
                <span className="truncate">{t('Suggest group names')}</span>
            </Button>
        </div>
    );
}

/**
 * The line above the columns in Grouping: how cards are grouped, and how far
 * the room is.
 */
export function GroupingBanner() {
    const ctx = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const { groups, cards } = groupingProgress(ctx.board);
    const online = ctx.online.length;

    return (
        <div
            data-slot="retro-grouping-banner"
            className="flex shrink-0 flex-col gap-3 px-4 pt-3 md:px-6"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-muted-foreground">
                <Combine className="size-4 shrink-0" aria-hidden />
                <p className="min-w-48 flex-1">
                    {isMobile
                        ? t(
                              'Open the menu of a card and choose “Add to group…”. Tap a title to rename it.',
                          )
                        : t(
                              'Drag a card onto another to group them. Click a title to rename it.',
                          )}
                </p>
                <Badge
                    variant="muted"
                    shape="pill"
                    data-slot="retro-grouping-progress"
                    className="max-w-full"
                >
                    <Layers aria-hidden />
                    <span className="truncate">
                        {groups === 1
                            ? t(':count group', { count: groups })
                            : t(':count groups', { count: groups })}
                        {' · '}
                        {cards === 1
                            ? t(':count card', { count: cards })
                            : t(':count cards', { count: cards })}
                    </span>
                </Badge>
                {online > 0 && (
                    <Badge
                        variant="muted"
                        shape="pill"
                        data-slot="retro-grouping-online"
                        className="max-w-full"
                    >
                        <Users aria-hidden />
                        <span className="truncate">
                            {t(':count online', { count: online })}
                        </span>
                    </Badge>
                )}
            </div>
            <SuggestGroupNames />
        </div>
    );
}

/** The suggested name of a group, until it is kept, changed or the group is named. */
function SuggestedName({
    lead,
    name,
    onEdit,
}: {
    lead: BoardCardData;
    name: string;
    onEdit: (name: string) => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const value = useContext(GroupNameSuggestionsContext);
    const [busy, setBusy] = useState(false);

    const accept = async () => {
        setBusy(true);
        const response = await ctx.run(
            retroRequest<GroupNameResponse>(
                CardGroupNamesController.update({
                    retro: ctx.board.retro.id,
                    card: lead.id,
                }),
                { name },
            ),
        );
        setBusy(false);

        if (response) {
            value?.dismiss(lead.id);
            ctx.apply({
                type: 'card.groupName',
                cardId: response.cardId,
                groupName: response.groupName,
            });
        }
    };

    return (
        <div
            data-slot="retro-group-suggested-name"
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
        >
            <span
                title={t('Suggested name')}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-dashed border-(--col-text) bg-card px-2 py-0.5 font-semibold text-(--col-text)"
            >
                <Sparkles className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{name}</span>
            </span>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="max-w-full"
                disabled={busy}
                onClick={() => void accept()}
            >
                <span className="truncate">{t('Use this name')}</span>
            </Button>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="max-w-full"
                disabled={busy}
                onClick={() => {
                    value?.dismiss(lead.id);
                    onEdit(name);
                }}
            >
                <span className="truncate">{t('Edit this name')}</span>
            </Button>
        </div>
    );
}

/**
 * The group is dragged by its section. Writing in one of its fields, or
 * selecting what is written there, must not move it.
 */
function keepFieldsOutOfTheDrag(event: PointerEvent<HTMLElement>): void {
    const { target } = event;

    if (target instanceof Element && target.closest('input, textarea')) {
        event.stopPropagation();
    }
}

/** A lead card and the cards grouped under it, on `CardGroup`. */
export function BoardGroup({
    lead,
    drag,
}: {
    lead: BoardCardData;
    drag?: CardDragState;
}) {
    const ctx = useBoard();
    const suggestions = useContext(GroupNameSuggestionsContext);
    const [suggestedDraft, setSuggestedDraft] = useState<string | null>(null);
    const vote = useCardVote(lead);
    const voteBlockedLabel = useVoteBlockedLabel();
    const group = toGroupProps(lead, ctx.board);
    const voting = cardVoting(lead, ctx.board);
    const retroId = ctx.board.retro.id;

    if (group === null) {
        return null;
    }

    const { canUngroup, ...groupProps } = group;
    const suggestion =
        lead.groupName === null ? suggestions?.suggestions[lead.id] : undefined;

    const rename = async (title: string | null) => {
        const route = { retro: retroId, card: lead.id };

        ctx.apply({
            type: 'card.groupName',
            cardId: lead.id,
            groupName: title,
        });

        const response = await ctx.run(
            title === null
                ? retroRequest<GroupNameResponse>(
                      CardGroupNamesController.destroy(route),
                  )
                : retroRequest<GroupNameResponse>(
                      CardGroupNamesController.update(route),
                      { name: title },
                  ),
        );

        if (response) {
            ctx.apply({
                type: 'card.groupName',
                cardId: response.cardId,
                groupName: response.groupName,
            });
        }
    };

    const ungroup = async (cardId: string) => {
        const response = await ctx.run(
            retroRequest<{ cards: CardPayload[] }>(
                CardGroupsController.destroy({ retro: retroId, card: cardId }),
            ),
        );

        if (response) {
            ctx.apply({ type: 'cards.upsert', cards: response.cards });
        }
    };

    return (
        <CardGroup
            {...groupProps}
            votes={voting?.votes}
            voteControls={
                voting ? (
                    <CardVotes
                        mine={voting.votes.mine}
                        total={voting.votes.total}
                        maxPerCard={voting.maxPerCard ?? undefined}
                        budgetLeft={ctx.board.viewer.remainingVotes}
                        hiddenTotalNote={false}
                        disabledReason={
                            voting.blocked === 'locked'
                                ? voteBlockedLabel(voting)
                                : undefined
                        }
                        onVote={() => vote(1)}
                        onUnvote={() => vote(-1)}
                    />
                ) : undefined
            }
            dropTarget={drag?.isDropTarget}
            className={drag?.isDragging ? DraggedCardClass : undefined}
            editingTitle={suggestedDraft !== null}
            titleDraft={suggestedDraft ?? undefined}
            titleHint={
                group.canEdit && suggestion !== undefined ? (
                    <SuggestedName
                        lead={lead}
                        name={suggestion}
                        onEdit={setSuggestedDraft}
                    />
                ) : undefined
            }
            onPointerDown={keepFieldsOutOfTheDrag}
            onEditingTitleChange={(editing) => {
                if (!editing) {
                    setSuggestedDraft(null);
                }
            }}
            onRename={(title) => void rename(title)}
            onUngroup={
                canUngroup ? (cardId) => void ungroup(cardId) : undefined
            }
            renderCard={(card) => {
                const member = ctx.board.cards.find(
                    (candidate) => candidate.id === card.id,
                );

                return member ? (
                    <BoardCard
                        card={member}
                        inGroup={{
                            className: card.className,
                            footer: card.footer,
                        }}
                    />
                ) : null;
            }}
        />
    );
}
