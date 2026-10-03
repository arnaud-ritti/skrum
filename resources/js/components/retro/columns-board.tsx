import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { EyeOff, ListChecks, Plus, SquarePen } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardPositionsController from '@/actions/App/Http/Controllers/Retros/CardPositionsController';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
import { ColumnColorOptions } from '@/components/skrum/column-color-picker';
import { ColumnTabs, columnTabId } from '@/components/skrum/column-tabs';
import type { ColumnTab } from '@/components/skrum/column-tabs';
import { EmptyState } from '@/components/skrum/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useActivity } from '@/hooks/use-retro-activity';
import { useSwipe } from '@/hooks/use-swipe';
import { useTrans } from '@/hooks/use-trans';
import {
    ColumnEditPhases,
    toColumnProps,
    writingProgress,
} from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards } from '@/lib/retro/board-reducer';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type {
    BoardColumn as BoardColumnData,
    CardPayload,
    ColumnColor,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { CardComposer, CardPreview, useGroupShortcut } from './board-card';
import { BoardColumn } from './board-column';
import { useBoard } from './board-context';
import { BoardCursors } from './board-cursors';
import { GroupingBanner } from './board-group';
import { parseDndId, useDragAccessibility } from './dnd';
import { PhaseVotingBar } from './phase-voting-bar';
import { SurveysColumn } from './surveys/surveys-column';

const DefaultColor: ColumnColor = 'moss';

function AddColumnForm({ className }: { className?: string }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [title, setTitle] = useState('');
    const [color, setColor] = useState<ColumnColor>(DefaultColor);
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = title.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);

        const response = await ctx.run(
            retroRequest<{ columns: BoardColumnData[] }>(
                ColumnsController.store(ctx.board.retro.id),
                { title: trimmed, color },
            ),
        );

        setSending(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'columns.set', columns: response.columns });
        setTitle('');
        setColor(DefaultColor);
    };

    return (
        <form
            data-slot="retro-add-column"
            className={cn(
                'flex w-column max-w-full shrink-0 snap-start flex-col gap-3 rounded-xl border border-dashed border-input p-3',
                className,
            )}
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Input
                value={title}
                maxLength={100}
                required
                placeholder={t('Column title')}
                aria-label={t('Column title')}
                onChange={(event) => setTitle(event.target.value)}
            />
            <ColumnColorOptions
                value={color}
                onValueChange={setColor}
                columnTitle={title}
            />
            <Button
                type="submit"
                size="sm"
                className="max-w-full self-start"
                disabled={sending || title.trim() === ''}
            >
                <Plus aria-hidden />
                <span className="truncate">{t('Add column')}</span>
            </Button>
        </form>
    );
}

/**
 * The line above the columns in Writing: what silent writing means, and how
 * far the room is.
 */
function WritingBanner({ typing }: { typing?: ReactNode }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { cards, written, present } = writingProgress(
        ctx.board,
        ctx.online.length,
    );

    return (
        <div
            data-slot="retro-writing-banner"
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 text-body-sm text-muted-foreground md:px-6"
        >
            <EyeOff className="size-4 shrink-0" aria-hidden />
            <p className="min-w-48 flex-1">
                {t(
                    'Silent writing: your cards are only visible to you until the reveal.',
                )}
            </p>
            {typing}
            <Badge
                variant="muted"
                shape="pill"
                data-slot="retro-writing-progress"
                className="max-w-full"
            >
                <SquarePen aria-hidden />
                <span className="truncate">
                    {cards === 1
                        ? t(':count card', { count: cards })
                        : t(':count cards', { count: cards })}
                    {' · '}
                    {t(':written/:present have written', { written, present })}
                </span>
            </Badge>
        </div>
    );
}

/** Tabs of the phone board that are not a column. */
const SurveysTab = '+surveys';
const AddColumnTab = '+column';

/**
 * The columns on a phone: one per screen, behind a tab each. A swipe goes to
 * the next or the previous one, and the round button writes a card in the
 * column on screen.
 */
function PhoneColumns({
    banner,
    dragging,
    canAddColumn,
    hideMyCursor,
}: {
    banner: ReactNode;
    /** A card is being dragged: the move is not a swipe. */
    dragging: boolean;
    canAddColumn: boolean;
    hideMyCursor: boolean;
}) {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const panelId = useId();
    const { phase, highlightedCardId } = board.retro;
    const columnOf = (cardId: string | null): string | null =>
        board.cards.find((card) => card.id === cardId)?.columnId ?? null;
    const [selected, setSelected] = useState<string | null>(() =>
        columnOf(highlightedCardId),
    );
    const [seenHighlight, setSeenHighlight] = useState(highlightedCardId);
    const [slide, setSlide] = useState<-1 | 1>(1);
    const [composing, setComposing] = useState(false);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const hasSurveys = SurveyPhases.includes(phase) && board.surveys.length > 0;

    // The card the facilitator puts in focus shows on every screen: its
    // column comes in front.
    if (seenHighlight !== highlightedCardId) {
        setSeenHighlight(highlightedCardId);

        const column = columnOf(highlightedCardId);

        if (column !== null) {
            setSelected(column);
        }
    }

    const tabs: ColumnTab[] = [
        ...(hasSurveys
            ? [{ id: SurveysTab, label: t('Surveys'), icon: ListChecks }]
            : []),
        ...board.columns.map((column) => ({
            id: column.id,
            label: column.title,
            color: column.color,
            count: toColumnProps(column, board).count,
        })),
        ...(canAddColumn
            ? [{ id: AddColumnTab, label: t('Add column'), icon: Plus }]
            : []),
    ];
    const active =
        tabs.find((tab) => tab.id === selected)?.id ??
        board.columns[0]?.id ??
        tabs[0]?.id ??
        null;
    const activeIndex = tabs.findIndex((tab) => tab.id === active);
    const column = board.columns.find((item) => item.id === active);
    const canWrite = column ? toColumnProps(column, board).canAdd : false;

    const select = (id: string) => {
        const index = tabs.findIndex((tab) => tab.id === id);

        if (index === -1 || index === activeIndex) {
            return;
        }

        setSlide(index > activeIndex ? 1 : -1);
        setSelected(id);
    };

    const swipe = useSwipe((direction) => {
        const target = tabs[activeIndex + direction];

        if (target) {
            select(target.id);
        }
    });
    const cancelSwipe = swipe.cancel;

    useEffect(() => {
        if (dragging) {
            cancelSwipe();
        }
    }, [dragging, cancelSwipe]);

    return (
        <div
            data-slot="retro-phone-columns"
            className="flex min-w-0 flex-1 flex-col"
        >
            {tabs.length > 0 && (
                <div
                    data-slot="retro-phone-columns-head"
                    className="sticky top-0 z-10 flex min-w-0 shrink-0 flex-col gap-2 border-b bg-background py-2"
                >
                    {phase === 'voting' && <PhaseVotingBar part="budget" />}
                    <ColumnTabs
                        aria-label={t('Columns')}
                        tabs={tabs}
                        value={active ?? ''}
                        panelId={panelId}
                        onValueChange={select}
                    />
                </div>
            )}
            {banner}
            <div
                ref={setPanel}
                id={panelId}
                role={active === null ? undefined : 'tabpanel'}
                aria-labelledby={
                    active === null ? undefined : columnTabId(panelId, active)
                }
                data-slot="retro-columns"
                className="relative flex min-w-0 flex-1 touch-pan-y flex-col overflow-x-clip p-4"
                onPointerDown={swipe.handlers.onPointerDown}
                onPointerCancel={swipe.handlers.onPointerCancel}
                onPointerUp={(event) => {
                    if (dragging) {
                        cancelSwipe();

                        return;
                    }

                    swipe.handlers.onPointerUp(event);
                }}
            >
                {board.columns.length === 0 && (
                    <EmptyState
                        module="retro"
                        illustration={false}
                        title={t('No columns yet.')}
                        description={
                            canAddColumn
                                ? t('Add a column to start writing.')
                                : t(
                                      'The facilitator has not added a column yet.',
                                  )
                        }
                    />
                )}
                <div
                    key={active}
                    data-slide={slide === 1 ? 'next' : 'previous'}
                    className={cn(
                        'flex min-w-0 animate-in flex-col duration-(--duration-base) ease-(--ease-enter) fade-in-0 motion-reduce:animate-none',
                        slide === 1
                            ? 'slide-in-from-right-8'
                            : 'slide-in-from-left-8',
                    )}
                >
                    {active === SurveysTab && <SurveysColumn />}
                    {column && (
                        <BoardColumn
                            column={column}
                            className="w-full max-w-none flex-none"
                            onAdd={() => setComposing(true)}
                        />
                    )}
                    {active === AddColumnTab && (
                        <AddColumnForm className="w-full" />
                    )}
                </div>
                <BoardCursors container={panel} hidden={hideMyCursor} />
            </div>
            {column && canWrite && (
                <>
                    <Button
                        type="button"
                        size="icon"
                        data-slot="retro-add-card"
                        aria-label={t('Add a card in :column', {
                            column: column.title,
                        })}
                        className={cn(
                            'fixed right-4 z-30 size-14 rounded-full shadow-raised',
                            board.viewer.isFacilitator
                                ? 'bottom-24'
                                : 'bottom-6',
                        )}
                        onClick={() => setComposing(true)}
                    >
                        <Plus aria-hidden className="size-6" />
                    </Button>
                    <Drawer
                        open={composing && !sessionExpired}
                        onOpenChange={setComposing}
                    >
                        <DrawerContent
                            aria-describedby={undefined}
                            data-slot="retro-add-card-drawer"
                        >
                            <DrawerHeader className="pr-10 text-left">
                                <DrawerTitle>
                                    {t('Add a card in :column', {
                                        column: column.title,
                                    })}
                                </DrawerTitle>
                            </DrawerHeader>
                            <CardComposer
                                columnId={column.id}
                                color={column.color}
                                autoFocus
                                onAdded={() => setComposing(false)}
                                onCancel={() => setComposing(false)}
                            />
                        </DrawerContent>
                    </Drawer>
                </>
            )}
        </div>
    );
}

/**
 * The columns, as every phase from Writing to Voting shows them, and the
 * Board tab of a completed retro.
 */
export function ColumnsBoard({
    hideMyCursor,
    typing,
}: {
    hideMyCursor: boolean;
    /** Place of the typing indicator of the Writing banner (RT-1). */
    typing?: ReactNode;
}) {
    const { board, dispatch, apply, run } = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: { distance: 6 },
    });
    // On a phone a finger that moves sideways is a swipe to the next column,
    // also when it starts on a card: cards move from the keyboard and from
    // "Add to group…" there.
    const sensors = useSensors(
        isMobile ? null : pointerSensor,
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const { announce, end } = useActivity();

    useGroupShortcut();

    const [activeCardWidth, setActiveCardWidth] = useState<number>();
    const [boardElement, setBoardElement] = useState<HTMLElement | null>(null);
    const dragAccessibility = useDragAccessibility(board);
    const activeCard =
        board.cards.find((card) => card.id === activeCardId) ?? null;
    const activeColor =
        board.columns.find((column) => column.id === activeCard?.columnId)
            ?.color ?? DefaultColor;
    const { phase } = board.retro;
    const canAddColumn =
        board.viewer.isFacilitator && ColumnEditPhases.includes(phase);

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        setActiveCardId(null);

        const dragged = parseDndId(active.id);
        const target = parseDndId(over?.id);

        if (dragged?.kind === 'card') {
            end('moving', dragged.id);
        }

        if (!dragged || !target || dragged.kind !== 'card') {
            return;
        }

        if (target.kind === 'card' && target.id === dragged.id) {
            return;
        }

        const retroId = board.retro.id;

        if (phase === 'grouping' && target.kind === 'card') {
            const response = await run(
                retroRequest<{ cards: CardPayload[] }>(
                    CardGroupsController.update({
                        retro: retroId,
                        card: dragged.id,
                    }),
                    { parent_card_id: target.id },
                ),
            );

            if (response) {
                apply({ type: 'cards.upsert', cards: response.cards });
            }

            return;
        }

        const targetCard =
            target.kind === 'card'
                ? board.cards.find((card) => card.id === target.id)
                : undefined;
        const columnId =
            target.kind === 'column' ? target.id : targetCard?.columnId;

        if (!columnId) {
            return;
        }

        const columnCards = topLevelCards(board.cards, columnId);
        const siblings = columnCards.filter((card) => card.id !== dragged.id);
        const draggedIndex = columnCards.findIndex(
            (card) => card.id === dragged.id,
        );
        const targetIndex = targetCard
            ? columnCards.findIndex((card) => card.id === targetCard.id)
            : -1;
        const movesDownWithinColumn =
            draggedIndex !== -1 && draggedIndex < targetIndex;
        const index = targetCard
            ? Math.max(
                  movesDownWithinColumn
                      ? targetIndex
                      : siblings.findIndex((card) => card.id === targetCard.id),
                  0,
              )
            : siblings.length;

        dispatch({ type: 'card.place', cardId: dragged.id, columnId, index });

        const response = await run(
            retroRequest<{ cards: CardPayload[] }>(
                CardPositionsController.update({
                    retro: retroId,
                    card: dragged.id,
                }),
                { column_id: columnId, index },
            ),
        );

        if (response) {
            apply({ type: 'cards.upsert', cards: response.cards });
        }
    };

    return (
        <DndContext
            id="retro-board"
            sensors={sensors}
            accessibility={dragAccessibility}
            collisionDetection={closestCenter}
            onDragStart={(event) => {
                const cardId = parseDndId(event.active.id)?.id ?? null;
                const cardElement =
                    cardId === null
                        ? null
                        : document.getElementById(`card-${cardId}`);

                setActiveCardId(cardId);
                setActiveCardWidth(cardElement?.getBoundingClientRect().width);

                if (cardId !== null) {
                    announce('moving', cardId);
                }
            }}
            onDragCancel={({ active }) => {
                const dragged = parseDndId(active.id);

                setActiveCardId(null);

                if (dragged?.kind === 'card') {
                    end('moving', dragged.id);
                }
            }}
            onDragEnd={(event) => void handleDragEnd(event)}
        >
            {isMobile ? (
                <PhoneColumns
                    banner={
                        <>
                            {phase === 'writing' && (
                                <WritingBanner typing={typing} />
                            )}
                            {phase === 'grouping' && <GroupingBanner />}
                            {phase === 'voting' && (
                                <PhaseVotingBar part="progress" />
                            )}
                        </>
                    }
                    dragging={activeCardId !== null}
                    canAddColumn={canAddColumn}
                    hideMyCursor={hideMyCursor}
                />
            ) : (
                <div className="flex min-w-0 flex-1 flex-col">
                    {phase === 'writing' && <WritingBanner typing={typing} />}
                    {phase === 'grouping' && <GroupingBanner />}
                    {phase === 'voting' && <PhaseVotingBar />}
                    <div
                        ref={setBoardElement}
                        data-slot="retro-columns"
                        className="relative flex min-w-0 flex-1 items-start gap-4 overflow-x-auto p-4 md:px-6 md:py-5"
                    >
                        <SurveysColumn className="w-column shrink-0" />
                        {board.columns.length === 0 && (
                            <EmptyState
                                module="retro"
                                illustration={false}
                                title={t('No columns yet.')}
                                description={
                                    canAddColumn
                                        ? t('Add a column to start writing.')
                                        : t(
                                              'The facilitator has not added a column yet.',
                                          )
                                }
                            />
                        )}
                        {board.columns.map((column) => (
                            <BoardColumn key={column.id} column={column} />
                        ))}
                        {canAddColumn && <AddColumnForm />}
                        <BoardCursors
                            container={boardElement}
                            hidden={hideMyCursor}
                        />
                    </div>
                </div>
            )}
            {/* Outside the frame's <main>: the preview must not be clipped by the scrolling board. */}
            {createPortal(
                <DragOverlay>
                    {activeCard ? (
                        <CardPreview
                            card={activeCard}
                            color={activeColor}
                            width={activeCardWidth}
                        />
                    ) : null}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}
