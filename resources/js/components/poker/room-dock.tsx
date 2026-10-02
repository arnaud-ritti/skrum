import { EyeOff, LayoutGrid, RotateCcw, Save, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { PokerCard, PokerDeck } from '@/components/skrum/poker-card';
import { suggestedEstimate } from '@/components/skrum/poker-table';
import { VoteDrawer } from '@/components/skrum/vote-drawer';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { useVote } from './use-round-actions';
import type { RoundActions } from './use-round-actions';

type Props = {
    /** The reaction bar, stacked above the deck panel with a `space-3` gap; it never overlaps it. */
    reactions?: ReactNode;
    actions: RoundActions;
    /** Phone: icon-only facilitator actions and the "All deck" drawer. */
    compact: boolean;
};

/** What the facilitator does once the cards are down, where the deck is (3-D8). */
function FacilitatorActions({
    actions,
    compact,
}: {
    actions: RoundActions;
    compact: boolean;
}) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const scope = useRef<HTMLDivElement>(null);
    const [choice, setChoice] = useState<{
        roundId: string;
        value: string;
    } | null>(null);
    const { game, current } = snapshot;

    const round = current?.round ?? null;
    const task = snapshot.tasks.find(
        (candidate) => candidate.id === current?.taskId,
    );
    const isRevealed = round !== null && round.revealedAt !== null;
    const estimateCards = game.cards.filter((card) => !isSpecialCard(card));
    const estimate =
        round !== null && choice?.roundId === round.id
            ? choice.value
            : (task?.estimate ??
              suggestedEstimate(round?.result, game.isNumeric) ??
              '');
    const { busy, next } = actions;
    const canSave = isRevealed && estimate !== '' && !busy;
    const canGoNext = next !== null && !busy;

    useShortcut('mod+enter', () => void actions.saveEstimate(estimate), {
        scope,
        enabled: canSave,
    });
    // A single key at document level: live with the result only, so that a
    // stray "n" cannot leave an open round behind.
    useShortcut('n', () => void actions.goToNext(), {
        scope,
        enabled: canGoNext && isRevealed,
    });

    if (round === null) {
        return null;
    }

    const revote: FacilitatorAction = {
        id: 'revote',
        label: t('Re-vote'),
        icon: RotateCcw,
        disabled: busy,
        onSelect: () => void actions.revote(),
    };
    const save: FacilitatorAction = {
        id: 'save-estimate',
        label: t('Save estimate'),
        icon: Save,
        shortcut: '⌘/Ctrl ↵',
        disabled: !canSave,
        disabledReason:
            estimate === '' ? t('Choose an estimate first.') : undefined,
        onSelect: () => void actions.saveEstimate(estimate),
    };
    const goNext: FacilitatorAction = {
        id: 'next-task',
        label: t('Next task'),
        icon: SkipForward,
        shortcut: isRevealed ? 'N' : undefined,
        disabled: !canGoNext,
        disabledReason:
            next === null ? t('Every other task has an estimate.') : undefined,
        onSelect: () => void actions.goToNext(),
    };

    return (
        <div ref={scope} className="flex max-w-full min-w-0">
            <FacilitatorBar
                label={t('Facilitator tools')}
                compact={compact}
                className={cn(
                    'border-0 bg-transparent p-0 shadow-none',
                    compact &&
                        '[&>[data-slot=facilitator-bar-separator]]:hidden',
                )}
                actions={isRevealed ? [revote] : []}
                end={
                    isRevealed ? (
                        <label className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md border border-input bg-card pr-1 pl-3 text-sm whitespace-nowrap">
                            <span aria-hidden className="truncate">
                                {t('Estimate')}
                            </span>
                            <Select
                                value={estimate}
                                onValueChange={(value) =>
                                    setChoice({ roundId: round.id, value })
                                }
                            >
                                <SelectTrigger
                                    size="sm"
                                    aria-label={t('Estimate')}
                                    className="h-6 min-w-16 border-0 bg-muted px-2 py-0 font-bold shadow-none"
                                >
                                    <SelectValue placeholder="–" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estimateCards.map((card) => (
                                        <SelectItem key={card} value={card}>
                                            {card}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                    ) : undefined
                }
                primary={isRevealed ? save : undefined}
                trailing={[goNext]}
            />
        </div>
    );
}

/** The deck as a watcher sees it: every card, none playable. */
function WatchedDeck({ className }: { className?: string }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { game } = snapshot;

    return (
        <div
            role="group"
            aria-label={t(':deck deck', { deck: game.deckLabel })}
            aria-disabled="true"
            data-slot="poker-deck"
            className={className}
        >
            {game.cards.map((card) => (
                <PokerCard key={card} value={card} disabled />
            ))}
        </div>
    );
}

export function RoomDock({ reactions, actions, compact }: Props) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, play, withdraw } = useVote();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { game, me, current } = snapshot;
    const round = current?.round ?? null;
    const isEnded = game.endedAt !== null;
    const isRevealed = round !== null && round.revealedAt !== null;
    const isClosed = round === null || isRevealed || isEnded;
    const hasDeck = snapshot.tasks.length > 0;
    const showsActions = me.isFacilitator && !isEnded && round !== null;
    const showsCards = !(compact && isRevealed);
    const deckClassName =
        'mx-auto max-w-full flex-nowrap justify-start overflow-x-auto';
    const dockRef = useRef<HTMLDivElement>(null);
    const hadFocusInside = useRef(false);
    const wasRevealed = useRef(isRevealed);

    // The control that held focus leaves with the state it belonged to
    // (Re-vote on a new round, a card on the reveal): focus follows to the
    // deck, or to the result.
    useEffect(() => {
        const before = wasRevealed.current;

        wasRevealed.current = isRevealed;

        if (before === isRevealed || !hadFocusInside.current) {
            return;
        }

        const dock = dockRef.current;
        const active = document.activeElement;
        const isLost =
            active === null ||
            active === document.body ||
            (dock !== null &&
                dock.contains(active) &&
                active.matches(':disabled'));

        if (!isLost) {
            return;
        }

        const seats = document.querySelector<HTMLElement>(
            '[data-slot="poker-table"] > section[tabindex="-1"]',
        );
        const target = isRevealed
            ? (document.querySelector<HTMLElement>(
                  '[data-slot="poker-result"]',
              ) ?? seats)
            : (dock?.querySelector<HTMLElement>(
                  '[data-slot="poker-deckbar"] [role="group"] button:not(:disabled)',
              ) ?? seats);

        target?.focus();
    }, [isRevealed]);

    const status = (): ReactNode => {
        if (!me.canVote && showsCards) {
            return (
                <>
                    <EyeOff aria-hidden className="size-4 shrink-0" />
                    <span className="min-w-0">
                        {t('Deck disabled while you watch only')}
                    </span>
                </>
            );
        }

        if (round === null || isEnded) {
            return null;
        }

        if (round.myVote === null) {
            return (
                <span className="min-w-0">
                    {isRevealed
                        ? t('The cards are revealed.')
                        : t('Choose your card')}
                </span>
            );
        }

        return (
            <span className="min-w-0">
                {t('Your card')}
                {' · '}
                <strong className="font-semibold text-foreground">
                    {round.myVote}
                </strong>
                {!isRevealed && ` — ${t('you can change it until the reveal')}`}
            </span>
        );
    };

    return (
        <div
            ref={dockRef}
            data-slot="poker-dock"
            onFocus={() => {
                hadFocusInside.current = true;
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    hadFocusInside.current = false;
                }
            }}
            className="flex w-full shrink-0 flex-col items-center gap-3"
        >
            {reactions}
            {hasDeck && (
                <div
                    data-slot="poker-deckbar"
                    className="flex w-full flex-col items-center gap-2 border-t border-border bg-background/70 px-4 pt-3 pb-4"
                >
                    <div className="flex w-full max-w-5xl min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                        <p
                            data-slot="poker-dock-status"
                            className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
                        >
                            {status()}
                        </p>
                        <span className="flex-1" />
                        {compact && me.canVote && !isClosed && (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setDrawerOpen(true)}
                            >
                                <LayoutGrid aria-hidden />
                                <span className="truncate">
                                    {t('All deck')}
                                </span>
                            </Button>
                        )}
                        {showsActions && (
                            <FacilitatorActions
                                actions={actions}
                                compact={compact}
                            />
                        )}
                    </div>
                    {showsCards && me.canVote && (
                        <PokerDeck
                            values={game.cards}
                            value={round?.myVote ?? null}
                            disabled={isClosed || busy}
                            selection="toggle"
                            className={deckClassName}
                            onChange={(card) => void play(card)}
                            onRetract={() => void withdraw()}
                        />
                    )}
                    {showsCards && !me.canVote && (
                        <WatchedDeck
                            className={cn(
                                'flex items-end gap-2 px-2 pt-4 pb-2',
                                deckClassName,
                            )}
                        />
                    )}
                </div>
            )}
            {compact && me.canVote && (
                <VoteDrawer
                    open={drawerOpen && !isClosed}
                    onOpenChange={setDrawerOpen}
                    deck={game.cards}
                    value={round?.myVote ?? null}
                    revealed={isRevealed}
                    onVote={(card) => void play(card)}
                    onRetract={() => void withdraw()}
                />
            )}
        </div>
    );
}
