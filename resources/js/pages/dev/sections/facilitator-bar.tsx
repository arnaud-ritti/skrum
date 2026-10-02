import {
    ArrowRight,
    Eye,
    EyeOff,
    EyeClosed,
    Flag,
    Focus,
    Lock,
    LockOpen,
    Pause,
    Play,
    Plus,
    Settings2,
    SkipBack,
    SkipForward,
    Trash2,
    Users,
    VenetianMask,
    Vote,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex min-w-0 justify-center overflow-hidden rounded-lg bg-muted/40 p-4">
                {children}
            </div>
        </div>
    );
}

function TimerStub({ children }: { children: string }) {
    return (
        <span className="inline-flex h-8 items-center rounded-md bg-muted px-2 font-mono text-sm tabular-nums">
            {children}
        </span>
    );
}

function useActionSets() {
    const { t } = useTrans();

    const make = (
        id: string,
        label: string,
        icon: FacilitatorAction['icon'],
        extra: Partial<FacilitatorAction> = {},
    ): FacilitatorAction => ({ id, label, icon, onSelect: noop, ...extra });

    const writing: FacilitatorAction[] = [
        make('pause', t('Pause'), Pause, { shortcut: 'T' }),
        make('add', t('+2 min'), Plus),
        make('anonymity', t('Anonymous'), VenetianMask, {
            kind: 'toggle',
            pressed: true,
        }),
        make('reveal', t('Reveal cards'), Eye, {
            kind: 'toggle',
            pressed: false,
            shortcut: 'R',
        }),
    ];
    const voting: FacilitatorAction[] = [
        make('add', t('+2 min'), Plus),
        make('settings', t('Votes per person'), Settings2),
        make('reveal', t('Reveal votes'), Vote, { shortcut: 'R' }),
    ];
    const discussing: FacilitatorAction[] = [
        make('follow', t('Everyone follows'), Users, {
            kind: 'toggle',
            pressed: true,
        }),
        make('previous', t('Previous topic'), SkipBack),
        make('next', t('Next topic'), SkipForward),
    ];
    const roti: FacilitatorAction[] = [
        make('relaunch', t('Relaunch the last 2'), Play),
        make('reveal', t('Reveal ROTI'), EyeClosed),
        make('finish', t('End session'), Flag, { tone: 'destructive' }),
    ];

    return { make, writing, voting, discussing, roti };
}

function Interactive() {
    const { t } = useTrans();
    const [revealed, setRevealed] = useState(false);
    const [locked, setLocked] = useState(false);
    const [focus, setFocus] = useState(false);
    const [paused, setPaused] = useState(false);

    const actions: FacilitatorAction[] = [
        {
            id: 'pause',
            label: paused ? t('Resume') : t('Pause'),
            icon: paused ? Play : Pause,
            onSelect: () => setPaused((value) => !value),
            shortcut: 'T',
        },
        {
            id: 'reveal',
            label: revealed ? t('Hide cards') : t('Reveal cards'),
            icon: revealed ? EyeOff : Eye,
            kind: 'toggle',
            pressed: revealed,
            shortcut: 'R',
            onSelect: () => setRevealed((value) => !value),
        },
        {
            id: 'lock',
            label: locked ? t('Board locked') : t('Lock board'),
            icon: locked ? LockOpen : Lock,
            kind: 'toggle',
            pressed: locked,
            tone: locked ? 'default' : undefined,
            shortcut: 'L',
            onSelect: () => setLocked((value) => !value),
        },
        {
            id: 'focus',
            label: focus ? t('Stop focus') : t('Focus on a card'),
            icon: Focus,
            kind: 'toggle',
            pressed: focus,
            shortcut: 'F',
            onSelect: () => setFocus((value) => !value),
        },
    ];

    return (
        <FacilitatorBar
            actions={actions}
            start={<TimerStub>{paused ? '04:12' : '05:00'}</TimerStub>}
            primary={{
                id: 'next',
                label: t('Grouping'),
                icon: ArrowRight,
                onSelect: noop,
                shortcut: 'Ctrl+→',
            }}
        />
    );
}

export default function FacilitatorBarSection() {
    const { t } = useTrans();
    const { make, writing, voting, discussing, roti } = useActionSets();
    const groupingPrimary = make('next', t('Grouping'), ArrowRight);

    const longActions: FacilitatorAction[] = [
        make(
            'reveal',
            t('Reveal all the cards of every column to the whole team'),
            Eye,
            { kind: 'toggle', pressed: false },
        ),
        make('lock', t('Lock the board while we are discussing'), Lock, {
            kind: 'toggle',
            pressed: true,
        }),
        make('clear', t('Delete every card that has no votes'), Trash2, {
            tone: 'destructive',
        }),
    ];

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Writing (cards hidden, timer, anonymity)')}>
                <FacilitatorBar
                    actions={writing}
                    start={<TimerStub>05:00</TimerStub>}
                    primary={groupingPrimary}
                />
            </Example>
            <Example label={t('Voting')}>
                <FacilitatorBar
                    actions={voting}
                    primary={make('next', t('Discussion'), ArrowRight)}
                />
            </Example>
            <Example label={t('Discussing (follow toggled on)')}>
                <FacilitatorBar
                    actions={discussing}
                    primary={make('actions', t('Actions'), ArrowRight)}
                />
            </Example>
            <Example label={t('ROTI (destructive end action)')}>
                <FacilitatorBar actions={roti} />
            </Example>
            <Example
                label={t(
                    'Interactive: toggles, tooltips with shortcuts, arrow keys move between controls',
                )}
            >
                <Interactive />
            </Example>
            <Example
                label={t('A disabled action with its reason (hover or focus)')}
            >
                <FacilitatorBar
                    actions={[
                        make('reveal', t('Reveal cards'), Eye, {
                            disabled: true,
                            disabledReason: t('Nobody has written a card yet'),
                        }),
                        make('lock', t('Lock board'), Lock, {
                            kind: 'toggle',
                            pressed: false,
                        }),
                    ]}
                    primary={groupingPrimary}
                />
            </Example>
            <Example
                label={t('Compact (mobile): icons only, other actions in More')}
            >
                <div className="w-80 max-w-full">
                    <FacilitatorBar
                        compact
                        actions={[
                            ...writing,
                            make('clear', t('Delete every card'), Trash2, {
                                tone: 'destructive',
                            }),
                        ]}
                        start={<TimerStub>05:00</TimerStub>}
                        primary={groupingPrimary}
                    />
                </div>
            </Example>
            <Example label={t('Long labels in a narrow container')}>
                <div className="w-80 max-w-full">
                    <FacilitatorBar
                        actions={longActions}
                        primary={make(
                            'next',
                            t(
                                'Move on to the grouping phase of the retrospective',
                            ),
                            ArrowRight,
                        )}
                    />
                </div>
            </Example>
            <Example label={t('No action')}>
                <FacilitatorBar
                    actions={[]}
                    start={<TimerStub>05:00</TimerStub>}
                />
            </Example>
        </div>
    );
}
