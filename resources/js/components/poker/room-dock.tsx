import { EyeOff, LayoutGrid, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { PokerCard, PokerDeck } from '@/components/skrum/poker-card';
import { VoteDrawer } from '@/components/skrum/vote-drawer';
import { Button } from '@/components/ui/button';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { RoomResult } from './room-result';
import { useVote } from './use-round-actions';
import type { RoundActions } from './use-round-actions';

type Props = {
    /** The reaction bar, stacked above the deck panel with a `space-3` gap; it never overlaps it. */
    reactions?: ReactNode;
    actions: RoundActions;
    /**
     * Phone: icon-only skip action and the "All deck" drawer; once revealed,
     * the dock keeps the facilitator's two buttons and the result is a card
     * of the stage (`RoomResult`, layout `card`).
     */
    compact: boolean;
};

/** The break card of a deck (`SpecialCards`): the one the C key plays. */
const CoffeeCard = '☕';

/** Before the reveal the facilitator can only skip to the next task. */
function SkipAction({
    actions,
    compact,
}: {
    actions: RoundActions;
    compact: boolean;
}) {
    const { t } = useTrans();
    const { busy, next } = actions;
    const goNext: FacilitatorAction = {
        id: 'next-task',
        label: t('Next task'),
        icon: SkipForward,
        disabled: next === null || busy,
        disabledReason:
            next === null ? t('Every other task has an estimate.') : undefined,
        onSelect: () => void actions.goToNext(),
    };

    return (
        <div className="flex max-w-full min-w-0">
            <FacilitatorBar
                label={t('Facilitator tools')}
                compact={compact}
                className={cn(
                    'border-0 bg-transparent p-0 shadow-none',
                    compact &&
                        '[&>[data-slot=facilitator-bar-separator]]:hidden',
                )}
                actions={[]}
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
    const canFacilitate = me.isFacilitator && !isEnded;
    const showsResult = isRevealed && current !== null;
    // On a phone the result is a card of the stage: the dock keeps its buttons.
    const showsResultPanel = showsResult && (!compact || canFacilitate);
    const deckClassName =
        'mx-auto max-w-full flex-nowrap justify-start overflow-x-auto';
    const dockRef = useRef<HTMLDivElement>(null);
    const wasRevealed = useRef(isRevealed);

    useShortcut('mod+enter', () => void actions.validate(actions.estimate), {
        scope: dockRef,
        enabled:
            canFacilitate &&
            showsResult &&
            actions.estimate !== '' &&
            !actions.busy,
    });
    // A single key at document level: live with the result only, so that a
    // stray "n" cannot leave an open round behind. It moves on without
    // saving an estimate.
    useShortcut('n', () => void actions.goToNext(), {
        scope: dockRef,
        enabled:
            canFacilitate &&
            showsResult &&
            actions.next !== null &&
            !actions.busy,
    });

    useShortcut('shift+r', () => void actions.revote(), {
        scope: dockRef,
        enabled: canFacilitate && showsResult && !actions.busy,
    });
    // The coffee card from anywhere on the page, as a click on it: a second
    // press takes it back.
    useShortcut(
        'c',
        () =>
            void (round?.myVote === CoffeeCard ? withdraw() : play(CoffeeCard)),
        {
            scope: dockRef,
            enabled:
                me.canVote &&
                hasDeck &&
                !isClosed &&
                !busy &&
                game.cards.includes(CoffeeCard),
        },
    );

    // The deck leaves on a reveal and the result on a re-vote, with the
    // control that held focus: focus goes to the result, or back to the deck.
    // Focus that stands elsewhere (a dialog, a field) is left alone.
    useEffect(() => {
        const before = wasRevealed.current;

        wasRevealed.current = isRevealed;

        if (before === isRevealed) {
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

        const target = isRevealed
            ? document.querySelector<HTMLElement>('[data-slot="poker-result"]')
            : (dock?.querySelector<HTMLElement>(
                  '[data-slot="poker-deckbar"] [role="group"] button:not(:disabled)',
              ) ??
              document.querySelector<HTMLElement>(
                  '[data-slot="poker-table"] > section[tabindex="-1"]',
              ));

        target?.focus();
    }, [isRevealed]);

    const status = (): ReactNode => {
        if (!me.canVote) {
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
            return <span className="min-w-0">{t('Choose your card')}</span>;
        }

        return (
            <span className="min-w-0">
                {t('Your card')}
                {' · '}
                <strong className="font-semibold text-foreground">
                    {round.myVote}
                </strong>
                {` — ${t('you can change it until the reveal')}`}
            </span>
        );
    };

    return (
        <div
            ref={dockRef}
            data-slot="poker-dock"
            className="flex w-full shrink-0 flex-col items-center gap-3"
        >
            {reactions}
            {hasDeck && showsResultPanel && (
                <div
                    data-slot="poker-deckbar"
                    className="flex w-full flex-col items-center border-t border-border bg-background/70 px-4 pt-3 pb-4"
                >
                    <RoomResult
                        layout={compact ? 'foot' : 'bar'}
                        actions={actions}
                        className="max-w-5xl"
                    />
                </div>
            )}
            {hasDeck && !showsResult && (
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
                        {canFacilitate && round !== null && (
                            <SkipAction actions={actions} compact={compact} />
                        )}
                    </div>
                    {me.canVote && (
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
                    {!me.canVote && (
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
