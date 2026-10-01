import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { CardVotes, VoteBudget } from '@/components/skrum/vote-dots';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function CardFrame({ text, children }: { text: string; children: ReactNode }) {
    return (
        <article className="flex w-full max-w-72 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-sm">{text}</p>
            {children}
        </article>
    );
}

function Interactive() {
    const { t } = useTrans();
    const budget = 5;
    const [mine, setMine] = useState(1);
    const left = budget - mine;

    return (
        <div className="flex flex-col gap-3">
            <VoteBudget total={budget} remaining={left} />
            <CardFrame
                text={t('Daily takes too long, we often run over by 15 min.')}
            >
                <CardVotes
                    mine={mine}
                    total={mine + 4}
                    maxPerCard={3}
                    budgetLeft={left}
                    onVote={() => setMine((value) => value + 1)}
                    onUnvote={() => setMine((value) => Math.max(0, value - 1))}
                />
            </CardFrame>
        </div>
    );
}

export default function VoteDotsSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Budget 5 of 5')}>
                <VoteBudget total={5} remaining={5} />
            </Example>
            <Example label={t('Budget 2 of 5')}>
                <VoteBudget total={5} remaining={2} />
            </Example>
            <Example label={t('No votes left')}>
                <VoteBudget total={5} remaining={0} />
            </Example>
            <Example
                label={t('Votes on a card (mine highlighted, remove button)')}
            >
                <CardFrame
                    text={t(
                        'Daily takes too long, we often run over by 15 min.',
                    )}
                >
                    <CardVotes
                        mine={2}
                        total={6}
                        maxPerCard={3}
                        budgetLeft={3}
                        onVote={noop}
                        onUnvote={noop}
                    />
                </CardFrame>
            </Example>
            <Example label={t('No vote of mine on the card')}>
                <CardFrame
                    text={t('Document the on-call rotation in the wiki.')}
                >
                    <CardVotes
                        mine={0}
                        total={2}
                        budgetLeft={3}
                        onVote={noop}
                        onUnvote={noop}
                    />
                </CardFrame>
            </Example>
            <Example
                label={t(
                    'No votes available (aria-disabled, tooltip on hover or focus)',
                )}
            >
                <CardFrame
                    text={t('Document the on-call rotation in the wiki.')}
                >
                    <CardVotes
                        mine={0}
                        total={2}
                        budgetLeft={0}
                        onVote={noop}
                        onUnvote={noop}
                    />
                </CardFrame>
            </Example>
            <Example label={t('Maximum per card reached')}>
                <CardFrame text={t('Try mob programming on a ticket.')}>
                    <CardVotes
                        mine={3}
                        total={5}
                        maxPerCard={3}
                        budgetLeft={2}
                        onVote={noop}
                        onUnvote={noop}
                    />
                </CardFrame>
            </Example>
            <Example label={t('Total hidden until reveal')}>
                <CardFrame text={t('Try mob programming on a ticket.')}>
                    <CardVotes
                        mine={1}
                        total={null}
                        budgetLeft={4}
                        onVote={noop}
                        onUnvote={noop}
                    />
                </CardFrame>
            </Example>
            <Example
                label={t(
                    'Pop animation on add (click Vote, or press V; Shift+V removes). Reduced motion: no pop.',
                )}
            >
                <Interactive />
            </Example>
        </div>
    );
}
