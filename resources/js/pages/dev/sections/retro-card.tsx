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

function DiscussExample() {
    const { t } = useTrans();
    const [focused, setFocused] = useState(true);

    return (
        <RetroCard
            id="discuss"
            color="lagoon"
            text={t('E2E tests break one time out of three in CI.')}
            author={{ id: 'b', name: 'Theo Martin', presence: 2 }}
            focused={focused}
            votes={{ total: 9, mine: 0 }}
            onFocusToggle={() => setFocused((value) => !value)}
        />
    );
}

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
            isMine
            onDelete={noop}
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
        presence: 4,
    } as const;
    const theo = {
        id: 'b',
        name: 'Theo Martin',
        presence: 2,
    } as const;
    const ines = {
        id: 'c',
        name: 'Ines Blanc',
        presence: 9,
    } as const;
    const withAvatar = {
        id: 'd',
        name: 'Lucas Durand',
        avatarUrl: `/avatars/${'3'.repeat(32)}.svg`,
    };
    const sampleGif = {
        previewUrl: `/avatars/${'7'.repeat(32)}.svg`,
        url: `/avatars/${'7'.repeat(32)}.svg`,
    };
    const sentence = `${t('E2E tests break one time out of three in CI.')} `;
    const text280 = sentence.repeat(10).slice(0, 280);
    const text1000 = sentence.repeat(40).slice(0, 1000);

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
                <Example
                    label={t('Reactions with names (hover) and a host picker')}
                >
                    <RetroCard
                        id="reaction-names"
                        color="sun"
                        text={t(
                            'Thursday pair programming unblocked the Postgres migration.',
                        )}
                        author={theo}
                        reactions={[
                            {
                                emoji: '👍',
                                count: 1,
                                mine: false,
                                names: ['Inès Bernard'],
                            },
                            {
                                emoji: '🎉',
                                count: 2,
                                mine: true,
                                names: ['Theo Martin', 'Camille Roux'],
                            },
                        ]}
                        onReact={noop}
                        onOpenReactionPicker={noop}
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
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                <Example label={t('My card: You badge, edit and delete')}>
                    <RetroCard
                        id="mine"
                        color="moss"
                        text={t('Code review happens too late')}
                        author={withAvatar}
                        isMine
                        canEdit
                        onEditStart={noop}
                        onDelete={noop}
                    />
                </Example>
                <Example label={t('GIF with text, comments')}>
                    <RetroCard
                        id="gif-text"
                        color="sky"
                        text={t('The release on Friday, in one picture.')}
                        gif={sampleGif}
                        author={withAvatar}
                        commentCount={3}
                        commentsOpen={false}
                        onGifOpen={noop}
                        onOpenComments={noop}
                        onReact={noop}
                    />
                </Example>
                <Example label={t('GIF only, no text')}>
                    <RetroCard
                        id="gif-only"
                        color="sun"
                        text={null}
                        gif={sampleGif}
                        author={null}
                        onGifOpen={noop}
                    />
                </Example>
                <Example label={t('Insight: sentiment and category')}>
                    <RetroCard
                        id="insight"
                        color="coral"
                        text={t(
                            'We find out about scope changes in the middle of the sprint.',
                        )}
                        author={theo}
                        insight={{
                            sentiment: 'negative',
                            category: t('Planning'),
                        }}
                        votes={{ total: 5, mine: 0 }}
                    />
                </Example>
                <Example label={t('Discussion: facilitator highlight toggle')}>
                    <DiscussExample />
                </Example>
                <Example label={t('Comments open, thread in the card')}>
                    <RetroCard
                        id="thread"
                        color="plum"
                        text={t('Previous retros had no follow-up on actions')}
                        author={ines}
                        commentCount={1}
                        commentsOpen
                        onOpenComments={noop}
                    >
                        <p className="rounded-md bg-card p-2 text-xs text-muted-foreground">
                            {t('Slot for the comment thread')}
                        </p>
                    </RetroCard>
                </Example>
                <Example label={t('Menu and footer slot')}>
                    <RetroCard
                        id="menu"
                        color="iris"
                        text={t('E2E tests break one time out of three in CI.')}
                        author={camille}
                        votes={{ total: 4, mine: 0 }}
                        menuEntries={[
                            {
                                type: 'item',
                                label: t('Create an action'),
                                onSelect: noop,
                            },
                            {
                                type: 'item',
                                label: t('Copy link'),
                                onSelect: noop,
                            },
                        ]}
                        footer={
                            <span className="truncate rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                                {t('Footer slot')}
                            </span>
                        }
                    />
                </Example>
                <Example label={t('Masked, my own card')}>
                    <RetroCard
                        id="masked-mine"
                        color="sky"
                        masked
                        isMine
                        text={null}
                        author={null}
                    />
                </Example>
            </div>
            <Example label={t('Extreme data in a 20rem container')}>
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="w-80 max-w-full">
                        <RetroCard
                            id="extreme-280"
                            color="moss"
                            text={text280}
                            author={{
                                id: 'long',
                                name: 'Maximilienne-Alexandrine de la Rochefoucauld-Montmorency III',
                            }}
                            isMine
                            canEdit
                            canVote
                            commentCount={128}
                            reactions={[
                                { emoji: '🎉', count: 200, mine: true },
                                { emoji: '💡', count: 99, mine: false },
                                { emoji: '❤️', count: 12, mine: false },
                            ]}
                            votes={{ total: 200, mine: 5 }}
                            onVote={noop}
                            onReact={noop}
                            onEditStart={noop}
                            onDelete={noop}
                            onOpenComments={noop}
                            onFocusToggle={noop}
                        />
                    </div>
                    <div className="w-80 max-w-full">
                        <RetroCard
                            id="extreme-1000"
                            color="coral"
                            text={text1000}
                            author={{
                                id: 'long-2',
                                name: 'Maximilienne-Alexandrine-de-la-Rochefoucauld-Montmorency-III',
                            }}
                            votes={{ total: 3, mine: 0 }}
                        />
                    </div>
                    <div className="w-80 max-w-full">
                        <RetroCard
                            id="extreme-unbroken"
                            color="iris"
                            text={'a'.repeat(280)}
                            author={null}
                            votes={{ total: 0, mine: 0 }}
                        />
                    </div>
                </div>
            </Example>
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
