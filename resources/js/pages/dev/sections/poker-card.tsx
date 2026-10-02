import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { PokerCard, PokerDeck } from '@/components/skrum/poker-card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const fibonacci = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
const twentyValues = [
    '0',
    '½',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '13',
    '16',
    '20',
    '21',
    '34',
    '40',
    '100',
    '?',
];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 pt-3">
            {children}
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

function InteractiveDeck({
    values,
    unit,
}: {
    values: string[];
    unit?: string;
}) {
    const [value, setValue] = useState<string | null>(null);

    return (
        <PokerDeck
            values={values}
            value={value}
            unit={unit}
            onChange={(next) => setValue(value === next ? null : next)}
            onRetract={() => setValue(null)}
        />
    );
}

function RevealDemo() {
    const { t } = useTrans();
    const [revealed, setRevealed] = useState(false);

    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                onClick={() => setRevealed((current) => !current)}
                className="w-fit rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="truncate">
                    {revealed ? t('Reset the round') : t('Reveal the cards')}
                </span>
            </button>
            <div className="flex flex-wrap gap-2">
                {['3', '5', '5', '8', '☕', '13'].map((value, index) => (
                    <PokerCard
                        key={index}
                        value={value}
                        faceDown={!revealed}
                        delay={index * 40}
                    />
                ))}
            </div>
        </div>
    );
}

export default function PokerCardSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Card states')}>
                <div className="flex flex-wrap gap-6">
                    <Cell label={t('Face down')}>
                        <PokerCard value="8" faceDown />
                    </Cell>
                    <Cell label={t('Revealed')}>
                        <PokerCard value="8" />
                    </Cell>
                    <Cell label={t('Selected')}>
                        <PokerCard value="8" selected onSelect={() => {}} />
                    </Cell>
                    <Cell label={t('Keyboard focus (Tab)')}>
                        <PokerCard value="8" onSelect={() => {}} />
                    </Cell>
                    <Cell label={t('Disabled')}>
                        <PokerCard value="8" disabled onSelect={() => {}} />
                    </Cell>
                    <Cell label={t('No vote')}>
                        <PokerCard value="8" empty />
                    </Cell>
                    <Cell label={t('Special')}>
                        <PokerCard value="?" />
                    </Cell>
                    <Cell label={t('Special')}>
                        <PokerCard value="☕" />
                    </Cell>
                </div>
            </Example>
            <Example label={t('Sizes: sm, md, lg')}>
                <div className="flex flex-wrap items-end gap-6">
                    <Cell label="sm">
                        <PokerCard value="13" size="sm" />
                    </Cell>
                    <Cell label="md">
                        <PokerCard value="13" size="md" />
                    </Cell>
                    <Cell label="lg">
                        <PokerCard value="13" size="lg" />
                    </Cell>
                    <Cell label="sm">
                        <PokerCard value="13" size="sm" faceDown />
                    </Cell>
                    <Cell label="lg">
                        <PokerCard value="13" size="lg" faceDown />
                    </Cell>
                </div>
            </Example>
            <Example label={t('Long value (8 characters) in each size')}>
                <div className="flex flex-wrap items-end gap-6">
                    <Cell label="sm">
                        <PokerCard value="Infinite" size="sm" />
                    </Cell>
                    <Cell label="md">
                        <PokerCard value="Infinite" size="md" />
                    </Cell>
                    <Cell label="lg">
                        <PokerCard value="Infinite" size="lg" />
                    </Cell>
                    <Cell label="md">
                        <PokerCard value="½" unit={t('days')} />
                    </Cell>
                </div>
            </Example>
            <Example
                label={t(
                    'Flip with a 40 ms stagger. Reduced motion: fade instead of flip.',
                )}
            >
                <RevealDemo />
            </Example>
            <Example label={t('Deck of 2 values')}>
                <InteractiveDeck values={['S', 'L']} />
            </Example>
            <Example
                label={t(
                    'Deck of 10 values (arrows move, Space picks, digits pick, Esc retracts)',
                )}
            >
                <InteractiveDeck values={fibonacci} />
            </Example>
            <Example label={t('Deck of 13 values with a unit')}>
                <InteractiveDeck
                    values={[
                        '0',
                        '½',
                        '1',
                        '2',
                        '3',
                        '5',
                        '8',
                        '13',
                        '20',
                        '40',
                        '100',
                        '?',
                        '☕',
                    ]}
                    unit={t('days')}
                />
            </Example>
            <Example
                label={t('Deck of 20 values wraps instead of overflowing')}
            >
                <div className="max-w-xl">
                    <InteractiveDeck values={twentyValues} />
                </div>
            </Example>
            <Example label={t('Deck closed (round over)')}>
                <PokerDeck
                    values={['1', '2', '3', '5']}
                    value="3"
                    disabled
                    onChange={() => {}}
                />
            </Example>
        </div>
    );
}
