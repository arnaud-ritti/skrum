import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { CardGroup } from '@/components/skrum/card-group';
import type { RetroCardProps } from '@/components/skrum/retro-card';
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

function scoped(scope: string, cards: RetroCardProps[]): RetroCardProps[] {
    return cards.map((card) => ({ ...card, id: `${scope}-${card.id}` }));
}

const sampleNames = ['Inès Bernard', 'Lucas Durand', 'Camille Roux'];

function useSampleCards(
    color: RetroCardProps['color'],
): [RetroCardProps[], RetroCardProps[]] {
    const { t } = useTrans();
    const ines = {
        id: 'ines',
        name: 'Inès Bernard',
        presence: 9,
    } as const;
    const lucas = {
        id: 'lucas',
        name: 'Lucas Durand',
        presence: 5,
    } as const;

    const three: RetroCardProps[] = [
        {
            id: 'a',
            color,
            text: t('Code reviews happen too late.'),
            author: ines,
        },
        {
            id: 'b',
            color,
            text: t('1,200-line pull requests are impossible to review.'),
            author: lucas,
        },
        {
            id: 'c',
            color,
            text: t('Nobody is assigned to reviews.'),
            author: null,
        },
    ];

    return [three, three.slice(0, 2)];
}

function Interactive() {
    const { t } = useTrans();
    const [cards] = useSampleCards('apricot');
    const [title, setTitle] = useState(t('Code review quality'));
    const [items, setItems] = useState(cards);

    return (
        <CardGroup
            id="interactive"
            title={title}
            color="apricot"
            cards={items}
            canEdit
            votes={{ total: 11, mine: 2 }}
            onRename={(next) => setTitle(next ?? '')}
            onUngroup={(cardId) =>
                setItems((current) =>
                    current.filter((card) => card.id !== cardId),
                )
            }
        />
    );
}

export default function CardGroupSection() {
    const { t } = useTrans();
    const [coral, coralTwo] = useSampleCards('coral');
    const [sky] = useSampleCards('sky');
    const [moss] = useSampleCards('moss');
    const longText = `${t('Code reviews happen too late.')} `
        .repeat(12)
        .slice(0, 280);
    const thirty: RetroCardProps[] = Array.from({ length: 30 }, (_, index) => ({
        id: `thirty-${index}`,
        color: 'amber',
        text:
            index === 1
                ? longText
                : `${t('Nobody is assigned to reviews.')} (${index + 1})`,
        author:
            index % 5 === 0
                ? null
                : {
                      id: `author-${index % 14}`,
                      name:
                          index === 2
                              ? 'Maximilienne-Alexandrine de la Rochefoucauld-Montmorency III'
                              : `${sampleNames[index % sampleNames.length]} ${(index % 14) + 1}`,
                      avatarUrl:
                          index % 3 === 0
                              ? `/avatars/${String(index % 10).repeat(32)}.svg`
                              : null,
                  },
        votes: { total: index % 7, mine: 0 },
    }));

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Example label={t('Expanded, editable title')}>
                    <CardGroup
                        id="expanded"
                        title={t('Code review quality')}
                        color="coral"
                        cards={scoped('g1', coral)}
                        canEdit
                        votes={{ total: 11, mine: 2 }}
                        onRename={noop}
                        onUngroup={noop}
                        onToggle={noop}
                    />
                </Example>
                <Example label={t('Collapsed stack')}>
                    <CardGroup
                        id="collapsed"
                        title={t('CI tooling')}
                        color="sky"
                        cards={scoped('g2', sky)}
                        collapsed
                        votes={{ total: 6, mine: 0 }}
                        onToggle={noop}
                    />
                </Example>
                <Example label={t('Title being edited')}>
                    <CardGroup
                        id="editing"
                        title={t('Team support')}
                        color="moss"
                        cards={scoped('g3', coralTwo).map((card) => ({
                            ...card,
                            color: 'moss',
                        }))}
                        canEdit
                        editingTitle
                        onRename={noop}
                    />
                </Example>
                <Example label={t('Drop target')}>
                    <CardGroup
                        id="drop"
                        title={t('Meetings')}
                        color="plum"
                        cards={scoped('g4', moss)
                            .slice(0, 2)
                            .map((card) => ({ ...card, color: 'plum' }))}
                        dropTarget
                    />
                </Example>
                <Example label={t('Read only, votes hidden')}>
                    <CardGroup
                        id="readonly"
                        title={t('Deployments')}
                        color="iris"
                        cards={scoped('g5', coralTwo).map((card) => ({
                            ...card,
                            color: 'iris',
                        }))}
                        votes={{ total: null, mine: 0 }}
                    />
                </Example>
                <Example label={t('No title: first card text')}>
                    <CardGroup
                        id="untitled"
                        title=""
                        color="lagoon"
                        cards={scoped('g6', coralTwo).map((card) => ({
                            ...card,
                            color: 'lagoon',
                        }))}
                    />
                </Example>
            </div>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Example
                    label={t('Ungroup beside the vote and delete controls')}
                >
                    <CardGroup
                        id="controls"
                        title={t('Code review quality')}
                        color="red"
                        cards={scoped('g7', coral).map((card) => ({
                            ...card,
                            color: 'red',
                            canEdit: true,
                            canVote: true,
                            isMine: true,
                            votes: { total: 3, mine: 1 },
                            onVote: noop,
                            onDelete: noop,
                            onEditStart: noop,
                        }))}
                        canEdit
                        votes={{ total: 9, mine: 3 }}
                        onRename={noop}
                        onUngroup={noop}
                    />
                </Example>
                <Example label={t('Masked cards: no text in title or labels')}>
                    <CardGroup
                        id="masked"
                        title=""
                        color="blue"
                        cards={scoped('g8', coralTwo).map((card) => ({
                            ...card,
                            color: 'blue',
                            text: null,
                            masked: true,
                        }))}
                        canEdit
                        onUngroup={noop}
                    />
                </Example>
                <Example
                    label={t('Collapsed with a masked card: its author hidden')}
                >
                    <CardGroup
                        id="masked-collapsed"
                        title={t('Code review quality')}
                        color="blue"
                        collapsed
                        cards={scoped('g9', coralTwo).map((card, index) => ({
                            ...card,
                            color: 'blue',
                            text: index === 0 ? card.text : null,
                            masked: index > 0,
                        }))}
                    />
                </Example>
                <Example label={t('No name yet, with a name suggestion')}>
                    <CardGroup
                        id="hint"
                        title=""
                        color="green"
                        cards={scoped('g10', coralTwo).map((card) => ({
                            ...card,
                            color: 'green',
                        }))}
                        canEdit
                        onRename={noop}
                        onUngroup={noop}
                        titleHint={
                            <p className="truncate text-xs text-muted-foreground">
                                {t('Suggested name: :name', {
                                    name: t('Code review quality'),
                                })}
                            </p>
                        }
                    />
                </Example>
                <Example label={t('Group of 30 cards, collapsed')}>
                    <CardGroup
                        id="thirty-collapsed"
                        title={t('Everything about deployments')}
                        color="amber"
                        cards={scoped('g11', thirty)}
                        collapsed
                        votes={{ total: 200, mine: 5 }}
                    />
                </Example>
            </div>
            <Example label={t('Group of 30 cards, expanded (20rem)')}>
                <div className="w-80 max-w-full">
                    <CardGroup
                        id="thirty"
                        title={t('Everything about deployments')}
                        color="green"
                        cards={scoped('g12', thirty).map((card) => ({
                            ...card,
                            color: 'green',
                        }))}
                        canEdit
                        votes={{ total: 200, mine: 5 }}
                        onRename={noop}
                        onUngroup={noop}
                    />
                </div>
            </Example>
            <Example
                label={t('Interactive: click the title, collapse, ungroup')}
            >
                <div className="max-w-sm">
                    <Interactive />
                </div>
            </Example>
            <Example label={t('Narrow container (20rem)')}>
                <div className="w-80">
                    <CardGroup
                        id="narrow"
                        title={t(
                            'A very long group title that must be truncated gracefully',
                        )}
                        color="sun"
                        cards={scoped('g13', coral).map((card) => ({
                            ...card,
                            color: 'sun',
                        }))}
                        canEdit
                        votes={{ total: 4, mine: 1 }}
                        onUngroup={noop}
                    />
                </div>
            </Example>
        </div>
    );
}
