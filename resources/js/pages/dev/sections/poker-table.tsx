import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { PokerTable } from '@/components/skrum/poker-table';
import type {
    PokerResult,
    PokerSeat,
    PokerValue,
} from '@/components/skrum/poker-table';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};
const noopValue = (value: PokerValue): void => {
    void value;
};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function makeSeats(
    entries: [string, PokerSeat['state'], string?][],
): PokerSeat[] {
    return entries.map(([name, state, value], index) => ({
        user: {
            id: `u-${name}`,
            name,
            initials: name.slice(0, 2).toUpperCase(),
            presence: (index % 12) + 1,
            role: 'member',
            status: 'online',
            isMe: name === 'Arnaud',
        },
        state,
        value,
    }));
}

const dispersionResult: PokerResult = {
    mean: 7.9,
    median: 5,
    mode: '5',
    agreement: 0.43,
    consensus: false,
    distribution: [
        { value: '3', count: 1 },
        { value: '5', count: 3 },
        { value: '8', count: 2 },
        { value: '13', count: 0 },
        { value: '21', count: 1 },
    ],
    outliers: ['u-Yuki', 'u-Lucas'],
};

const consensusResult: PokerResult = {
    mean: 7.5,
    median: 8,
    mode: '8',
    agreement: 0.83,
    consensus: true,
    distribution: [
        { value: '3', count: 0 },
        { value: '5', count: 1 },
        { value: '8', count: 5 },
        { value: '13', count: 0 },
    ],
    outliers: [],
};

export default function PokerTableSection() {
    const { t } = useTrans();
    const story = {
        key: 'ATLAS-1290',
        title: t('Export actions as CSV'),
        url: '#',
    };

    const voting = makeSeats([
        ['Camille', 'voted'],
        ['Theo', 'waiting'],
        ['Ines', 'voted'],
        ['Yuki', 'voted'],
        ['Malik', 'absent'],
        ['Sofia', 'voted'],
        ['Arnaud', 'voted'],
        ['Lucas', 'waiting'],
    ]);
    const dispersion = makeSeats([
        ['Camille', 'voted', '5'],
        ['Theo', 'voted', '8'],
        ['Ines', 'voted', '5'],
        ['Yuki', 'voted', '21'],
        ['Malik', 'voted', '☕'],
        ['Sofia', 'voted', '8'],
        ['Arnaud', 'voted', '5'],
        ['Lucas', 'voted', '3'],
    ]);
    const agreed = makeSeats([
        ['Camille', 'voted', '8'],
        ['Theo', 'voted', '8'],
        ['Ines', 'voted', '8'],
        ['Yuki', 'voted', '5'],
        ['Sofia', 'voted', '8'],
        ['Arnaud', 'voted', '8'],
    ]);
    const crowd = Array.from({ length: 14 }, (_, index) => {
        const names = [
            'Camille',
            'Theo',
            'Ines',
            'Yuki',
            'Malik',
            'Sofia',
            'Arnaud',
            'Lucas',
            'Noah',
            'Mia',
            'Hugo',
            'Lena',
            'Omar',
            'Jade',
        ];

        return [names[index], index % 3 === 0 ? 'waiting' : 'voted'] as [
            string,
            PokerSeat['state'],
        ];
    });

    return (
        <div className="flex flex-col gap-10 p-4 md:p-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-8">
                <Example label={t('Voting in progress, facilitator')}>
                    <PokerTable
                        story={story}
                        seats={voting}
                        revealed={false}
                        isFacilitator
                        onReveal={noop}
                    />
                </Example>
                <Example label={t('Voting in progress, participant')}>
                    <PokerTable story={story} seats={voting} revealed={false} />
                </Example>
            </div>
            <Example label={t('Revealed, strong dispersion (coffee excluded)')}>
                <PokerTable
                    story={story}
                    seats={dispersion}
                    revealed
                    result={dispersionResult}
                    isFacilitator
                    onRevote={noop}
                    onAccept={noopValue}
                    onNext={noop}
                />
            </Example>
            <Example label={t('Revealed, consensus')}>
                <PokerTable
                    story={story}
                    seats={agreed}
                    revealed
                    result={consensusResult}
                    isFacilitator
                    onAccept={noopValue}
                    onNext={noop}
                />
            </Example>
            <Example label={t('Revealed, participant view')}>
                <PokerTable
                    story={story}
                    seats={agreed}
                    revealed
                    result={consensusResult}
                />
            </Example>
            <Example label={t('More than 12 seats: seat grid')}>
                <PokerTable
                    story={story}
                    seats={makeSeats(crowd)}
                    revealed={false}
                    isFacilitator
                    onReveal={noop}
                />
            </Example>
        </div>
    );
}
