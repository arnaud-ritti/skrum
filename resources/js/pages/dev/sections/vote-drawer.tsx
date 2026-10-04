import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ReactionDrawerGrid } from '@/components/skrum/reaction-drawer';
import { VoteDrawer, VoteDrawerPanel } from '@/components/skrum/vote-drawer';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};
const fullDeck = [
    '0',
    '1',
    '2',
    '3',
    '5',
    '8',
    '13',
    '21',
    '34',
    '55',
    '?',
    '☕',
];
const wideDeck = [
    ...Array.from({ length: 17 }, (_, index) => `${index + 1}`),
    'XXL-size',
    '?',
    '☕',
];
const palette = [
    '🎉',
    '👍',
    '❤️',
    '😂',
    '🤔',
    '👀',
    '🔥',
    '👏',
    '💡',
    '😮',
    '🙏',
];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

/** The sheet of a drawer, in the page flow: no portal, no focus trap. */
function Sheet({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="flex w-full max-w-lg min-w-0 flex-col rounded-t-2xl border border-b-0 bg-popover px-5 pt-2 pb-8 text-popover-foreground shadow-modal">
            <span
                aria-hidden
                className="mx-auto mb-3 h-1 w-8 shrink-0 rounded-full bg-border"
            />
            <div className="flex flex-col gap-1 pb-2 text-center">
                <p className="text-ui-lg font-semibold">{title}</p>
                <p className="line-clamp-2 text-sm break-words text-muted-foreground">
                    {description}
                </p>
            </div>
            {children}
        </div>
    );
}

function VoteSheet({
    deck,
    value,
    disabledValues,
    withRetract = false,
}: {
    deck: string[];
    value?: string;
    disabledValues?: string[];
    withRetract?: boolean;
}) {
    const { t } = useTrans();

    return (
        <Sheet
            title={t('Choose your card')}
            description={t('Pick a card, then validate your vote.')}
        >
            <VoteDrawerPanel
                deck={deck}
                value={value}
                disabledValues={disabledValues}
                onVote={noop}
                onRetract={withRetract ? noop : undefined}
            />
        </Sheet>
    );
}

function OpenDrawer() {
    const { t } = useTrans();
    const [open, setOpen] = useState(true);
    const [container, setContainer] = useState<HTMLDivElement | null>(null);

    return (
        <div
            ref={setContainer}
            className="relative h-dvh max-h-200 w-full [transform:translateZ(0)] overflow-hidden rounded-lg border border-border bg-muted/40 p-3"
        >
            <button
                type="button"
                className="h-11 max-w-full min-w-0 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(true)}
            >
                <span className="truncate">{t('Open vote drawer')}</span>
            </button>
            {container !== null && (
                <VoteDrawer
                    open={open}
                    onOpenChange={setOpen}
                    modal={false}
                    container={container}
                    deck={wideDeck}
                    value="8"
                    disabledValues={['13']}
                    onVote={noop}
                    onRetract={noop}
                />
            )}
        </div>
    );
}

export default function VoteDrawerSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Vote: 12 values, 5 selected, 13 unavailable, special cards, remove my vote',
                )}
            >
                <VoteSheet
                    deck={fullDeck}
                    value="5"
                    disabledValues={['13']}
                    withRetract
                />
            </Example>
            <Example label={t('Vote: nothing picked yet, validation disabled')}>
                <VoteSheet deck={fullDeck} />
            </Example>
            <Example label={t('Vote: two values')}>
                <VoteSheet deck={['S', 'L']} value="L" />
            </Example>
            <Example
                label={t('Vote: 20 values with an 8-character value (wrap)')}
            >
                <VoteSheet deck={wideDeck} value="XXL-size" withRetract />
            </Example>
            <Example
                label={t(
                    'Reactions: 11 emoji, mine highlighted, a 280-character excerpt',
                )}
            >
                <Sheet
                    title={t('React to this card')}
                    description={Array(7)
                        .fill(t('Daily takes too long, we often run over.'))
                        .join(' ')
                        .slice(0, 280)}
                >
                    <ReactionDrawerGrid
                        palette={palette}
                        reactions={[
                            { emoji: '🎉', count: 3, mine: true },
                            { emoji: '👍', count: 1, mine: false },
                        ]}
                        onReact={noop}
                    />
                </Sheet>
            </Example>
            <Example
                label={t('Reactions: none yet, and one outside the palette')}
            >
                <Sheet
                    title={t('React to this card')}
                    description={t('Daily takes too long, we often run over.')}
                >
                    <ReactionDrawerGrid
                        palette={palette.slice(0, 6)}
                        reactions={[{ emoji: '🚀', count: 120, mine: true }]}
                        onReact={noop}
                    />
                </Sheet>
            </Example>
            <Example
                label={t(
                    'Real drawer, open: 20 values, 8 selected, 13 unavailable (scrolls inside the sheet)',
                )}
            >
                <OpenDrawer />
            </Example>
        </div>
    );
}
