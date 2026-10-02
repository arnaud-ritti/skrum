import { useState } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ReactionDrawer } from '@/components/skrum/reaction-drawer';
import { VoteDrawer } from '@/components/skrum/vote-drawer';
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

export default function VoteDrawerSection() {
    const { t } = useTrans();
    const [voteOpen, setVoteOpen] = useState(true);
    const [reactionOpen, setReactionOpen] = useState(true);

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <p className="text-sm text-muted-foreground">
                {t(
                    'Both drawers are rendered open (vaul portals to the page body, non-modal here so they can coexist). The vote drawer sits at the bottom, the reaction drawer at the top.',
                )}
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="h-11 rounded-md border px-3 text-sm"
                    onClick={() => setVoteOpen(true)}
                >
                    <span className="truncate">{t('Open vote drawer')}</span>
                </button>
                <button
                    type="button"
                    className="h-11 rounded-md border px-3 text-sm"
                    onClick={() => setReactionOpen(true)}
                >
                    <span className="truncate">
                        {t('Open reaction drawer')}
                    </span>
                </button>
            </div>
            <p className="text-sm font-medium">
                {t(
                    'Vote drawer: 12 values, 5 selected, 13 unavailable, special cards, remove my vote',
                )}
            </p>
            <VoteDrawer
                open={voteOpen}
                onOpenChange={setVoteOpen}
                modal={false}
                deck={fullDeck}
                value="5"
                disabledValues={['13']}
                onVote={noop}
                onRetract={noop}
            />
            <p className="text-sm font-medium">
                {t(
                    'Reaction drawer: 11 emoji, mine highlighted, a 280-character excerpt',
                )}
            </p>
            <ReactionDrawer
                open={reactionOpen}
                onOpenChange={setReactionOpen}
                modal={false}
                // vaul extends a drawer downwards with an ::after block: at the top of the page it would cover the vote drawer.
                className="top-4 bottom-auto rounded-b-2xl border-b after:hidden"
                cardExcerpt={'Daily takes too long, we often run over. '.repeat(
                    7,
                )}
                palette={palette}
                reactions={[
                    { emoji: '🎉', count: 3, mine: true },
                    { emoji: '👍', count: 1, mine: false },
                ]}
                onReact={noop}
            />
            <p className="text-sm font-medium">
                {t('20 values with an 8-character value (wrap, scroll)')}
            </p>
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                {wideDeck.map((card) => (
                    <span key={card} className="rounded border px-1">
                        {card}
                    </span>
                ))}
            </div>
        </div>
    );
}
