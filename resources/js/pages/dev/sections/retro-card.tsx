import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { RetroCard } from '@/components/skrum/retro-card';
import type { ColumnColor } from '@/components/skrum/retro-card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

const colors: ColumnColor[] = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
];

function Interactive() {
    const { t } = useTrans();
    const [text, setText] = useState(t('Too many meetings on Monday morning'));
    const [editing, setEditing] = useState(false);
    const [mine, setMine] = useState(0);
    const [reactions, setReactions] = useState([
        { emoji: '🎉', count: 2, mine: false },
    ]);

    return (
        <RetroCard
            id="interactive"
            color="apricot"
            text={text}
            author={{
                id: 'a',
                name: 'Camille Roux',
                initials: 'CR',
                presence: 4,
            }}
            editing={editing}
            canEdit
            canVote
            votes={{ total: 3 + mine, mine }}
            reactions={reactions}
            onVote={(delta) => setMine((value) => Math.max(0, value + delta))}
            onReact={(emoji) =>
                setReactions((current) =>
                    current.some((reaction) => reaction.emoji === emoji)
                        ? current.map((reaction) =>
                              reaction.emoji === emoji
                                  ? {
                                        ...reaction,
                                        mine: !reaction.mine,
                                        count:
                                            reaction.count +
                                            (reaction.mine ? -1 : 1),
                                    }
                                  : reaction,
                          )
                        : [...current, { emoji, count: 1, mine: true }],
                )
            }
            onEditStart={() => setEditing(true)}
            onEditCancel={() => setEditing(false)}
            onEdit={(value) => {
                setText(value);
                setEditing(false);
            }}
        />
    );
}

export default function RetroCardSection() {
    const { t } = useTrans();
    const camille = {
        id: 'a',
        name: 'Camille Roux',
        initials: 'CR',
        presence: 4,
    } as const;
    const theo = {
        id: 'b',
        name: 'Theo Martin',
        initials: 'TM',
        presence: 2,
    } as const;
    const ines = {
        id: 'c',
        name: 'Ines Blanc',
        initials: 'IB',
        presence: 9,
    } as const;

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                <Example label={t('Default')}>
                    <RetroCard
                        id="1"
                        color="moss"
                        text={t(
                            'The client demo went great, the new onboarding convinced them.',
                        )}
                        author={camille}
                        votes={{ total: 3, mine: 0 }}
                        canVote
                        onVote={noop}
                    />
                </Example>
                <Example label={t('Anonymous')}>
                    <RetroCard
                        id="2"
                        color="coral"
                        text={t(
                            'We find out about scope changes in the middle of the sprint.',
                        )}
                        author={null}
                        votes={{ total: 0, mine: 0 }}
                        canVote
                        onVote={noop}
                    />
                </Example>
                <Example label={t('Masked, writing phase')}>
                    <RetroCard
                        id="3"
                        color="sky"
                        masked
                        text={t(
                            'Text hidden from other participants until the reveal.',
                        )}
                        author={theo}
                    />
                </Example>
                <Example label={t('Reactions and my votes')}>
                    <RetroCard
                        id="4"
                        color="sun"
                        text={t(
                            'Thursday pair programming unblocked the Postgres migration.',
                        )}
                        author={theo}
                        reactions={[
                            { emoji: '🎉', count: 4, mine: true },
                            { emoji: '💡', count: 2, mine: false },
                        ]}
                        votes={{ total: 7, mine: 2 }}
                        canVote
                        onVote={noop}
                        onReact={noop}
                    />
                </Example>
                <Example label={t('Edited by someone else')}>
                    <RetroCard
                        id="5"
                        color="iris"
                        text={t('Previous retros had no follow-up on actions')}
                        author={ines}
                        lockedBy={{ name: 'Ines', presence: 9 }}
                    />
                </Example>
                <Example label={t('Editing (me), counter')}>
                    <RetroCard
                        id="6"
                        color="apricot"
                        text={t('Too many meetings on Monday morning')}
                        author={camille}
                        editing
                        onEdit={noop}
                        onEditCancel={noop}
                    />
                </Example>
                <Example label={t('Editing, locked mid-edit by someone else')}>
                    <RetroCard
                        id="7"
                        color="apricot"
                        text={t('Too many meetings on Monday morning')}
                        author={camille}
                        editing
                        lockedBy={{ name: 'Ines', presence: 9 }}
                        onEdit={noop}
                    />
                </Example>
                <Example label={t('Selected')}>
                    <RetroCard
                        id="8"
                        color="plum"
                        text={t('Code review happens too late')}
                        author={camille}
                        selected
                        votes={{ total: 1, mine: 0 }}
                    />
                </Example>
                <Example label={t('Facilitator focus')}>
                    <RetroCard
                        id="9"
                        color="lagoon"
                        text={t('E2E tests break one time out of three in CI.')}
                        author={theo}
                        focused
                        votes={{ total: 9, mine: 0 }}
                        canVote
                        onVote={noop}
                    />
                </Example>
                <Example label={t('Votes hidden by the facilitator')}>
                    <RetroCard
                        id="10"
                        color="moss"
                        text={t('Votes stay hidden until the reveal.')}
                        author={ines}
                        votes={{ total: null, mine: 1 }}
                        canVote
                        onVote={noop}
                    />
                </Example>
                <Example label={t('Dragging and original slot')}>
                    <div className="relative h-40">
                        <div className="absolute top-0 right-4.5 left-0">
                            <RetroCard
                                id="11"
                                color="plum"
                                ghost
                                text={t('Code review happens too late')}
                                author={camille}
                            />
                        </div>
                        <div className="absolute top-9 right-0 left-4.5">
                            <RetroCard
                                id="12"
                                color="plum"
                                dragging
                                text={t('Code review happens too late')}
                                author={camille}
                            />
                        </div>
                    </div>
                </Example>
                <Example label={t('Interactive: V votes, Enter edits')}>
                    <Interactive />
                </Example>
            </div>
            <Example label={t('All column colors')}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {colors.map((color) => (
                        <RetroCard
                            key={color}
                            id={color}
                            color={color}
                            text={t('Sample card text')}
                            author={camille}
                            votes={{ total: 2, mine: 0 }}
                        />
                    ))}
                </div>
            </Example>
            <Example label={t('Narrow container (20rem)')}>
                <div className="w-80">
                    <RetroCard
                        id="narrow"
                        color="sky"
                        text={t(
                            'The client demo went great, the new onboarding convinced them.',
                        )}
                        author={camille}
                        reactions={[{ emoji: '🎉', count: 4, mine: true }]}
                        votes={{ total: 7, mine: 3 }}
                        canVote
                        canEdit
                        onVote={noop}
                        onReact={noop}
                        onDelete={noop}
                    />
                </div>
            </Example>
        </div>
    );
}
