import { Ellipsis, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { PokerTable } from '@/components/skrum/poker-table';
import type {
    PokerResult,
    PokerSeat,
    PokerValue,
} from '@/components/skrum/poker-table';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};
const noopValue = (value: PokerValue): void => {
    void value;
};

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
    'Elio',
    'Nora',
    'Paul',
    'Zoe',
    'Ivan',
    'Rosa',
];

const longName = 'Maximilian-Alexander von Hohenzollern-Sigmaringen the Fourth';

const fibonacci = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'];

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
            presence: (index % 12) + 1,
            isMe: name === 'Arnaud',
        },
        state,
        value,
    }));
}

function crowd(count: number): PokerSeat[] {
    return makeSeats(
        names
            .slice(0, count)
            .map((name, index) => [
                name,
                index % 3 === 0 ? 'waiting' : 'voted',
            ]),
    );
}

const dispersionResult: PokerResult = {
    average: 7.9,
    mode: ['5'],
    consensus: false,
    nearestCard: '8',
    distribution: [
        { value: '3', count: 1 },
        { value: '5', count: 3 },
        { value: '8', count: 2 },
        { value: '21', count: 1 },
    ],
};

const consensusResult: PokerResult = {
    average: 7.5,
    mode: ['8'],
    consensus: true,
    nearestCard: '8',
    distribution: [
        { value: '5', count: 1 },
        { value: '8', count: 5 },
    ],
};

const tshirtResult: PokerResult = {
    average: null,
    mode: ['M', 'L'],
    consensus: false,
    nearestCard: null,
    distribution: [
        { value: 'S', count: 1 },
        { value: 'M', count: 2 },
        { value: 'L', count: 2 },
        { value: '?', count: 1 },
    ],
};

const uncountableResult: PokerResult = {
    average: null,
    mode: [],
    consensus: false,
    nearestCard: null,
    distribution: [
        { value: '?', count: 3 },
        { value: '☕', count: 1 },
    ],
};

const extremeValues = Array.from({ length: 20 }, (_, index) =>
    `${index + 1} points`.slice(0, 8),
);

const extremeResult: PokerResult = {
    average: null,
    mode: [extremeValues[0], extremeValues[1], extremeValues[2]],
    consensus: false,
    nearestCard: null,
    distribution: extremeValues.map((value, index) => ({
        value,
        count: index < 3 ? 2 : 1,
    })),
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
    const withWatchers: PokerSeat[] = [
        ...makeSeats([
            ['Camille', 'voted', 'M'],
            ['Theo', 'voted', 'L'],
            ['Ines', 'voted', 'M'],
            ['Yuki', 'voted', 'L'],
            ['Sofia', 'voted', 'S'],
            ['Arnaud', 'voted', '?'],
        ]),
        ...makeSeats([
            ['Noah', 'watching'],
            ['Mia', 'watching'],
        ]),
    ];
    const offline: PokerSeat[] = voting.map((seat, index) =>
        index === 3 ? { ...seat, offline: true } : seat,
    );
    const extremeSeats = makeSeats([
        [longName, 'voted', extremeValues[0]],
        ['Theo', 'voted', extremeValues[1]],
        ['Ines', 'voted', extremeValues[19]],
    ]);
    const seatMenu = (seat: PokerSeat): ReactNode => (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Role of :name', { name: seat.user.name })}
        >
            <Ellipsis aria-hidden />
        </Button>
    );

    return (
        <div className="flex flex-col gap-10 p-4 md:p-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-8">
                <Example
                    label={t(
                        'Voting in progress, facilitator (crown, timer slot, next task)',
                    )}
                >
                    <PokerTable
                        story={story}
                        seats={voting}
                        revealed={false}
                        isFacilitator
                        facilitatorId="u-Arnaud"
                        votingTools={
                            <Button type="button" variant="outline" size="sm">
                                <Timer aria-hidden />
                                <span className="truncate">
                                    {t('Start timer')}
                                </span>
                            </Button>
                        }
                        onReveal={noop}
                        onNext={noop}
                    />
                </Example>
                <Example
                    label={t(
                        'Voting in progress, participant, one voter offline',
                    )}
                >
                    <PokerTable
                        story={story}
                        seats={offline}
                        revealed={false}
                        facilitatorId="u-Camille"
                    />
                </Example>
            </div>
            <Example label={t('Nobody voted yet: reveal disabled')}>
                <PokerTable
                    story={story}
                    seats={makeSeats([
                        ['Camille', 'waiting'],
                        ['Theo', 'waiting'],
                        ['Arnaud', 'waiting'],
                    ])}
                    revealed={false}
                    isFacilitator
                    onReveal={noop}
                />
            </Example>
            <Example
                label={t(
                    'Revealed, strong dispersion (coffee excluded), optional outliers, median and agreement given',
                )}
            >
                <PokerTable
                    story={story}
                    seats={dispersion}
                    revealed
                    result={{
                        ...dispersionResult,
                        median: 5,
                        agreement: 0.43,
                        outliers: ['u-Yuki', 'u-Lucas'],
                    }}
                    isFacilitator
                    estimateValues={fibonacci}
                    onRevote={noop}
                    onAccept={noopValue}
                    onNext={noop}
                />
            </Example>
            <Example
                label={t('Revealed, consensus, revealed when everyone voted')}
            >
                <PokerTable
                    story={story}
                    seats={agreed}
                    revealed
                    result={consensusResult}
                    revealReason="everyone_voted"
                    isFacilitator
                    estimateValues={fibonacci}
                    onRevote={noop}
                    onAccept={noopValue}
                    onNext={noop}
                    nextDisabled
                />
            </Example>
            <Example
                label={t('Revealed, participant view (server result only)')}
            >
                <PokerTable
                    story={story}
                    seats={agreed}
                    revealed
                    result={consensusResult}
                    revealReason="timer"
                />
            </Example>
            <Example
                label={t(
                    'Revealed, anonymous round: seats stay face down, values listed without names',
                )}
            >
                <PokerTable
                    story={story}
                    seats={dispersion}
                    revealed
                    anonymous
                    result={dispersionResult}
                />
            </Example>
            <Example
                label={t(
                    'Revealed, T-shirt deck with two modes, watchers and seat menus',
                )}
            >
                <PokerTable
                    story={story}
                    seats={withWatchers}
                    revealed
                    isNumeric={false}
                    result={tshirtResult}
                    isFacilitator
                    facilitatorId="u-Arnaud"
                    seatMenu={seatMenu}
                    estimateValues={['XS', 'S', 'M', 'L', 'XL']}
                    onRevote={noop}
                    onAccept={noopValue}
                    onNext={noop}
                />
            </Example>
            <Example label={t('Revealed, no countable votes')}>
                <PokerTable
                    story={story}
                    seats={makeSeats([
                        ['Camille', 'voted', '?'],
                        ['Theo', 'voted', '?'],
                        ['Ines', 'voted', '☕'],
                        ['Arnaud', 'voted', '?'],
                    ])}
                    revealed
                    result={uncountableResult}
                    isFacilitator
                    onRevote={noop}
                    onAccept={noopValue}
                />
            </Example>
            {[2, 8, 12, 20].map((count) => (
                <Example
                    key={count}
                    label={t(':count seats, in a 20rem and a 60rem container', {
                        count,
                    })}
                >
                    <div className="flex min-w-0 flex-col gap-6">
                        <div className="w-80 max-w-full">
                            <PokerTable
                                story={story}
                                seats={crowd(count)}
                                revealed={false}
                                isFacilitator
                                shortcuts={false}
                                onReveal={noop}
                            />
                        </div>
                        <div className="w-240 max-w-full">
                            <PokerTable
                                story={story}
                                seats={crowd(count)}
                                revealed={false}
                                isFacilitator
                                shortcuts={false}
                                onReveal={noop}
                            />
                        </div>
                    </div>
                </Example>
            ))}
            <Example
                label={t(
                    'Extreme data: 60-character name, 8-character values, 20 distribution values, 20rem container',
                )}
            >
                <div className="w-80 max-w-full">
                    <PokerTable
                        story={{
                            title: t(
                                'A story title long enough to be truncated in the middle of the table',
                            ),
                        }}
                        seats={extremeSeats}
                        revealed
                        isNumeric={false}
                        result={extremeResult}
                        isFacilitator
                        shortcuts={false}
                        estimateValues={extremeValues}
                        onRevote={noop}
                        onAccept={noopValue}
                        onNext={noop}
                    />
                </div>
            </Example>
        </div>
    );
}
