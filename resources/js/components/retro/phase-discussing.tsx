import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    ScanEye,
} from 'lucide-react';
import { createContext, Fragment, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import CardDiscussionsController from '@/actions/App/Http/Controllers/Retros/CardDiscussionsController';
import RetroHighlightsController from '@/actions/App/Http/Controllers/Retros/RetroHighlightsController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import { EmptyState } from '@/components/skrum/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShortcut } from '@/hooks/use-shortcut';
import { useSwipe } from '@/hooks/use-swipe';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { stepTopic, topicOfCard, topicsFrom } from '@/lib/retro/topics';
import type { Topic } from '@/lib/retro/topics';
import { cn } from '@/lib/utils';
import { ActionItemsList } from './action-items-list';
import { useBoard } from './board-context';
import { BoardCursors } from './board-cursors';
import { applyHighlightAnswer } from './highlight-answer';
import type { HighlightAnswer } from './highlight-answer';
import { SuggestionsPanel } from './suggestions-panel';
import { SurveysColumn } from './surveys/surveys-column';
import { TopicFocus, TopicUpNext } from './topic-focus';
import { TopicsList } from './topics-list';

type DiscussionValue = {
    topics: Topic[];
    /** The topic in front of the viewer. */
    current: Topic | null;
    /** The topic the facilitator put in focus for everyone. */
    shared: Topic | null;
    /** "Everyone follows": the presentation mode of the retro. */
    follows: boolean;
    /** The shared topic is shown to the viewer over the board. */
    presenting: boolean;
    busy: boolean;
    goTo: (topic: Topic) => void;
    step: (offset: -1 | 1) => void;
    backToShared: () => void;
    setFollows: (follows: boolean) => void;
    stopPresenting: () => void;
    /** A participant closes the presented topic for themselves. */
    dismiss: () => void;
    /** The facilitator marks a topic discussed, or takes the mark back (RT-7). */
    toggleDiscussed: (topic: Topic) => void;
};

type DiscussedAnswer = { cardId: string; discussedAt: string | null };

const DiscussionContext = createContext<DiscussionValue | null>(null);

/** The topic of the card, or of the row of the topics list, a key was pressed on. */
function topicOfFocus(
    topics: Topic[],
    target: EventTarget | null,
): Topic | null {
    if (!(target instanceof Element)) {
        return null;
    }

    const row = target.closest('[data-topic-id]');

    if (row !== null) {
        const id = row.getAttribute('data-topic-id');

        return topics.find((topic) => topic.id === id) ?? null;
    }

    return topicOfCard(
        topics,
        target.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
    );
}

/** The discussion, for what sits outside the phase body: the facilitator bar. */
export function useOptionalDiscussion(): DiscussionValue | null {
    return useContext(DiscussionContext);
}

export function useDiscussion(): DiscussionValue {
    const value = useContext(DiscussionContext);

    if (!value) {
        throw new Error(
            'The discussion must be used inside <DiscussionProvider>.',
        );
    }

    return value;
}

/**
 * Who looks at which topic. While discussing, everyone browses the topics for
 * themselves. A card the facilitator highlights becomes the topic of
 * everyone; while "Everyone follows" is on, the facilitator's own moves
 * highlight theirs.
 *
 * In Actions nobody browses: the one topic is the highlighted one, and every
 * move of the facilitator highlights.
 */
export function DiscussionProvider({ children }: { children: ReactNode }) {
    const ctx = useBoard();
    const { board } = ctx;
    const { retro, viewer } = board;
    const isDiscussing = retro.phase === 'discussing';
    const isActions = retro.phase === 'actions';
    const topics = isDiscussing || isActions ? topicsFrom(board) : [];
    const shared = topicOfCard(topics, retro.highlightedCardId);
    const [ownId, setOwnId] = useState<string | null>(null);
    const [seenHighlight, setSeenHighlight] = useState(retro.highlightedCardId);
    const [dismissedId, setDismissedId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const switching = useRef(false);
    const marking = useRef(false);

    if (seenHighlight !== retro.highlightedCardId) {
        setSeenHighlight(retro.highlightedCardId);
        setDismissedId(null);

        if (shared !== null) {
            setOwnId(shared.id);
        }
    }

    const current = isActions
        ? (shared ?? undefined)
        : (topics.find((topic) => topic.id === ownId) ?? shared ?? topics[0]);
    const follows = retro.presentationMode;
    const movesEveryone = isActions || follows;
    const sharedLead = board.cards.find(
        (card) => card.id === shared?.leadCardId,
    );
    const presenting =
        isDiscussing &&
        follows &&
        shared !== null &&
        sharedLead?.hidden === false &&
        dismissedId !== retro.highlightedCardId;

    /** Resolves to whether the card is now the topic of everyone. */
    const highlight = async (cardId: string | null): Promise<boolean> => {
        if (inFlight.current) {
            return false;
        }

        inFlight.current = true;
        setBusy(true);

        const response = await ctx.run(
            retroRequest<HighlightAnswer>(
                RetroHighlightsController.update(retro.id),
                { card_id: cardId },
            ),
        );

        inFlight.current = false;
        setBusy(false);

        if (!response) {
            return false;
        }

        applyHighlightAnswer(ctx.apply, response);

        return true;
    };

    const toggleDiscussed = async (topic: Topic): Promise<void> => {
        if (marking.current) {
            return;
        }

        const lead = board.cards.find((card) => card.id === topic.leadCardId);
        const args = { retro: retro.id, card: topic.leadCardId };

        marking.current = true;

        const response = await ctx.run(
            retroRequest<DiscussedAnswer>(
                lead?.discussedAt
                    ? CardDiscussionsController.destroy(args)
                    : CardDiscussionsController.update(args),
            ),
        );

        marking.current = false;

        if (response) {
            ctx.apply({ type: 'topic.discussed', ...response });
        }
    };

    // F on the card or the topic that has the focus: the "focus" button of
    // the card, from the keyboard. It also answers inside the presentation
    // overlay, whose card is the one in focus.
    useShortcut(
        'f',
        (event) => {
            if (event.repeat) {
                return;
            }

            const topic = topicOfFocus(topics, event.target);

            if (topic !== null) {
                void highlight(
                    shared?.id === topic.id ? null : topic.leadCardId,
                );
            }
        },
        {
            enabled: viewer.isFacilitator && (isDiscussing || isActions),
            enableInOverlays: true,
        },
    );

    // D on the card or the topic that has the focus: the "discussed" mark of
    // the stage, from the keyboard.
    useShortcut(
        'd',
        (event) => {
            if (event.repeat) {
                return;
            }

            const topic = topicOfFocus(topics, event.target);

            if (topic !== null) {
                void toggleDiscussed(topic);
            }
        },
        { enabled: viewer.isFacilitator && isDiscussing },
    );

    // While everyone follows, the facilitator's topic is the shared one: a
    // move that cannot be shared does not move them alone.
    const goTo = (topic: Topic): void => {
        const shares =
            viewer.isFacilitator && movesEveryone && shared?.id !== topic.id;

        if (!shares) {
            setOwnId(topic.id);

            return;
        }

        if (inFlight.current || switching.current) {
            return;
        }

        const before = shared?.id ?? null;

        setOwnId(topic.id);
        void highlight(topic.leadCardId).then((isShared) => {
            if (!isShared) {
                setOwnId(before);
            }
        });
    };

    const setFollows = async (next: boolean): Promise<void> => {
        if (switching.current || inFlight.current) {
            return;
        }

        switching.current = true;
        setBusy(true);

        try {
            const saved = await ctx.run(
                retroRequest(RetroSettingsController.update(retro.id), {
                    presentation_mode: next,
                }),
            );

            if (saved === undefined) {
                return;
            }

            await ctx.refetch();
        } finally {
            switching.current = false;
            setBusy(false);
        }

        if (next && current && shared?.id !== current.id) {
            await highlight(current.leadCardId);
        }
    };

    const value: DiscussionValue = {
        topics,
        current: current ?? null,
        shared,
        follows,
        presenting,
        busy,
        goTo,
        step: (offset) => {
            // In Actions the list may start with no topic in focus: "Next
            // topic" then opens on the most voted one.
            const target =
                current === undefined && offset === 1
                    ? (topics[0] ?? null)
                    : stepTopic(topics, current?.id ?? null, offset);

            if (target) {
                goTo(target);
            }
        },
        backToShared: () => setOwnId(shared?.id ?? null),
        setFollows: (next) => void setFollows(next),
        stopPresenting: () => void highlight(null),
        dismiss: () => setDismissedId(retro.highlightedCardId),
        toggleDiscussed: (topic) => void toggleDiscussed(topic),
    };

    return <DiscussionContext value={value}>{children}</DiscussionContext>;
}

/** "Previous topic" and "Next topic", for the viewer's own topic. */
function TopicNav({ timer }: { timer?: ReactNode }) {
    const { t } = useTrans();
    const { topics, current, step } = useDiscussion();
    const index = topics.findIndex((topic) => topic.id === current?.id);

    return (
        <div
            data-slot="retro-topic-nav"
            className="@container/topic-nav flex min-w-0 flex-wrap items-center justify-between gap-3"
        >
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="max-w-full min-w-0"
                disabled={index <= 0}
                onClick={() => step(-1)}
            >
                <ChevronLeft aria-hidden />
                <span className="truncate">{t('Previous topic')}</span>
            </Button>
            {timer}
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="max-w-full min-w-0"
                disabled={index === -1 || index >= topics.length - 1}
                onClick={() => step(1)}
            >
                <span className="truncate">{t('Next topic')}</span>
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );
}

/** Says that everyone looks at one topic, and brings back a viewer who left it. */
function FollowBanner({ following }: { following?: ReactNode }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { current, shared, follows, backToShared } = useDiscussion();

    if (!follows || shared === null) {
        return null;
    }

    const isAway = current?.id !== shared.id;
    const facilitator = board.participants.find(
        (participant) =>
            participant.id === board.retro.facilitatorParticipantId,
    );

    return (
        <div
            data-slot="retro-topic-follow"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-skrum-info-soft py-2 pr-2 pl-3 text-body-sm font-semibold text-skrum-info-text"
        >
            <ScanEye className="size-4 shrink-0" aria-hidden />
            <span role="status" className="min-w-0 flex-1 basis-48">
                {isAway
                    ? t('Everyone is looking at another topic.')
                    : t(
                          ':name put this topic in focus — everyone is looking here',
                          { name: facilitator?.name ?? t('The facilitator') },
                      )}
            </span>
            {following}
            {isAway && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="max-w-full min-w-0 bg-card text-foreground"
                    onClick={backToShared}
                >
                    <span className="truncate">{t('Back to the topic')}</span>
                </Button>
            )}
        </div>
    );
}

/** The facilitator's "discussed" mark of the topic in front of them (RT-7). */
function DiscussedToggle({ topic }: { topic: Topic }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { toggleDiscussed } = useDiscussion();
    const lead = board.cards.find((card) => card.id === topic.leadCardId);
    const isDiscussed = Boolean(lead?.discussedAt);

    if (!board.viewer.isFacilitator) {
        return null;
    }

    return (
        <Button
            type="button"
            size="sm"
            variant={isDiscussed ? 'secondary' : 'outline'}
            data-slot="retro-topic-discussed"
            aria-pressed={isDiscussed}
            aria-keyshortcuts="D"
            className={cn(
                'max-w-full min-w-0',
                isDiscussed && 'text-skrum-success-text',
            )}
            onClick={() => toggleDiscussed(topic)}
        >
            <CircleCheck aria-hidden />
            <span className="truncate">
                {isDiscussed ? t('Discussed') : t('Mark as discussed')}
            </span>
        </Button>
    );
}

type Props = {
    hideMyCursor: boolean;
    /** Place of the timer of the topic, between the two navigation buttons (RT-5). */
    timer?: ReactNode;
    /** Place of the shared notes, above the action items (RT-6). */
    notes?: ReactNode;
    /** Place of the count of people who follow, in the focus banner. */
    following?: ReactNode;
    /** Place of the "discussed" mark and of the action count of a topic (RT-7, RT-8). */
    topicMeta?: (topic: Topic) => ReactNode;
    /** Place of the action items, linked to the viewer's topic (RT-8). */
    actions?: ReactNode;
    /** Place of the time left for the discussion, in the topics list's footer (RT-5). */
    estimate?: ReactNode;
    /** Place of the last line of the topics list: the time per topic and the actions so far (RT-5). */
    summary?: ReactNode;
    /** Place of the time the topic up next will get (RT-5). */
    upNextEstimate?: ReactNode;
};

/**
 * Discussing: the topics by votes, the topic in front of the viewer, and the
 * panels of what the room decides. On a wide screen the three columns scroll
 * on their own; below, the page scrolls as one.
 */
export function PhaseDiscussing({
    hideMyCursor,
    timer,
    notes,
    following,
    topicMeta,
    actions = <ActionItemsList />,
    estimate,
    summary,
    upNextEstimate,
}: Props) {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const { topics, current, shared, presenting, goTo, step } = useDiscussion();
    const isMobile = useIsMobile();
    const [stage, setStage] = useState<HTMLElement | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const swipe = useSwipe(step);
    const index = topics.findIndex((topic) => topic.id === current?.id);
    const next = topics[index + 1];
    const position = t('Topic :current of :total', {
        current: index + 1,
        total: topics.length,
    });

    const panels: { id: string; node: ReactNode }[] = [
        { id: 'notes', node: notes },
        { id: 'actions', node: actions },
        { id: 'suggestions', node: <SuggestionsPanel /> },
        { id: 'surveys', node: <SurveysColumn /> },
    ];

    return (
        <div
            data-slot="retro-discussion"
            className="grid min-w-0 shrink-0 grow grid-cols-1 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,20rem)] xl:min-h-0 xl:shrink xl:grid-cols-[19.5rem_minmax(0,1fr)_23rem] xl:grid-rows-[minmax(0,1fr)]"
        >
            {isMobile ? (
                topics.length > 0 && (
                    <div
                        data-slot="retro-topics-selector"
                        className="sticky top-0 z-10 flex min-w-0 border-b bg-background px-4 py-2"
                    >
                        <Button
                            type="button"
                            variant="outline"
                            aria-haspopup="dialog"
                            aria-expanded={listOpen && !sessionExpired}
                            className="h-11 w-full min-w-0 justify-start gap-2"
                            onClick={() => setListOpen(true)}
                        >
                            <span
                                aria-hidden
                                className="shrink-0 font-mono text-xs font-semibold text-skrum-primary-text tabular-nums"
                            >
                                {index + 1}/{topics.length}
                            </span>
                            <span className="sr-only">{position}</span>
                            <span className="min-w-0 flex-1 truncate text-left">
                                {current?.title || t('GIF')}
                            </span>
                            <ChevronDown aria-hidden />
                        </Button>
                        <Drawer
                            open={listOpen && !sessionExpired}
                            onOpenChange={setListOpen}
                        >
                            <DrawerContent
                                aria-describedby={undefined}
                                data-slot="retro-topics-drawer"
                                className="px-0"
                            >
                                <DrawerTitle className="sr-only">
                                    {t('Topics')}
                                </DrawerTitle>
                                <div className="min-h-0 overflow-y-auto">
                                    <TopicsList
                                        topics={topics}
                                        columns={board.columns}
                                        currentId={current?.id ?? null}
                                        sharedId={shared?.id ?? null}
                                        actionCount={board.actionItems.length}
                                        rowMeta={topicMeta}
                                        estimate={estimate}
                                        summary={summary}
                                        className="border-b-0 bg-transparent"
                                        onSelect={(topic) => {
                                            goTo(topic);
                                            setListOpen(false);
                                        }}
                                    />
                                </div>
                            </DrawerContent>
                        </Drawer>
                    </div>
                )
            ) : (
                <TopicsList
                    topics={topics}
                    columns={board.columns}
                    currentId={current?.id ?? null}
                    sharedId={shared?.id ?? null}
                    actionCount={board.actionItems.length}
                    rowMeta={topicMeta}
                    estimate={estimate}
                    summary={summary}
                    onSelect={goTo}
                />
            )}
            <div
                ref={setStage}
                data-slot="retro-topic-stage"
                className={cn(
                    'relative flex min-w-0 flex-col gap-4 px-4 pt-4 md:px-6 xl:overflow-y-auto',
                    board.viewer.isFacilitator ? 'xl:pb-40' : 'xl:pb-32',
                    isMobile && 'touch-pan-y',
                )}
                {...(isMobile ? swipe.handlers : {})}
            >
                <FollowBanner following={following} />
                {current ? (
                    <>
                        <TopicNav timer={timer} />
                        {!presenting && (
                            <TopicFocus
                                key={current.id}
                                topic={current}
                                rank={index + 1}
                                mark={<DiscussedToggle topic={current} />}
                            />
                        )}
                        {next && (
                            <TopicUpNext
                                topic={next}
                                rank={index + 2}
                                estimate={upNextEstimate}
                            />
                        )}
                    </>
                ) : (
                    <EmptyState
                        module="retro"
                        illustration={false}
                        title={t('No topics to discuss.')}
                        description={t('Nobody wrote a card in this retro.')}
                    />
                )}
                <BoardCursors container={stage} hidden={hideMyCursor} />
            </div>
            <div
                data-slot="retro-discussion-panels"
                className={cn(
                    'flex min-w-0 flex-col gap-4 p-4 lg:pl-0 xl:overflow-y-auto',
                    board.viewer.isFacilitator ? 'xl:pb-40' : 'xl:pb-32',
                )}
            >
                {panels.map((panel) => (
                    <Fragment key={panel.id}>{panel.node}</Fragment>
                ))}
            </div>
        </div>
    );
}

/**
 * The presentation mode: the topic the facilitator put in focus, over the
 * board of everyone. A participant closes it for themselves; the
 * facilitator's close stops presenting for everyone.
 */
export function PresentationOverlay() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const discussion = useDiscussion();
    const { topics, shared, presenting, busy } = discussion;
    const { isFacilitator } = board.viewer;
    const index = topics.findIndex((topic) => topic.id === shared?.id);

    return (
        <Dialog
            open={presenting && !sessionExpired}
            onOpenChange={(open) => {
                if (open) {
                    return;
                }

                if (isFacilitator) {
                    discussion.stopPresenting();

                    return;
                }

                discussion.dismiss();
            }}
        >
            <DialogContent
                aria-describedby={undefined}
                data-slot="retro-presentation"
                className="pt-12 sm:max-w-3xl"
                onOpenAutoFocus={(event) => {
                    const { currentTarget } = event;

                    if (!(currentTarget instanceof HTMLElement)) {
                        return;
                    }

                    // The names of who reacted are read out on arrival, as
                    // the overlay always did.
                    const reaction = currentTarget.querySelector<HTMLElement>(
                        '[data-slot="retro-card-reactions"] button:enabled',
                    );

                    if (reaction) {
                        event.preventDefault();
                        reaction.focus();
                    }
                }}
            >
                <DialogTitle className="sr-only">
                    {t('Presentation mode')}
                </DialogTitle>
                {shared && presenting && (
                    <TopicFocus
                        key={shared.id}
                        topic={shared}
                        rank={index + 1}
                    />
                )}
                {isFacilitator && (
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="max-w-full min-w-0"
                            disabled={busy || index <= 0}
                            onClick={() => discussion.step(-1)}
                        >
                            <ChevronLeft aria-hidden />
                            <span className="truncate">
                                {t('Previous topic')}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mr-auto max-w-full min-w-0"
                            disabled={busy || index >= topics.length - 1}
                            onClick={() => discussion.step(1)}
                        >
                            <span className="truncate">{t('Next topic')}</span>
                            <ChevronRight aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="max-w-full min-w-0"
                            disabled={busy}
                            onClick={discussion.stopPresenting}
                        >
                            <span className="truncate">
                                {t('Stop presenting')}
                            </span>
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
