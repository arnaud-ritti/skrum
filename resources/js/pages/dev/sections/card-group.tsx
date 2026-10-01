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

function useSampleCards(
    color: RetroCardProps['color'],
): [RetroCardProps[], RetroCardProps[]] {
    const { t } = useTrans();
    const ines = {
        id: 'ines',
        name: 'Inès Bernard',
        initials: 'IB',
        presence: 9,
    } as const;
    const lucas = {
        id: 'lucas',
        name: 'Lucas Durand',
        initials: 'LD',
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
            onRename={setTitle}
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

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Example label={t('Expanded, editable title')}>
                    <CardGroup
                        id="expanded"
                        title={t('Code review quality')}
                        color="coral"
                        cards={coral}
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
                        cards={sky}
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
                        cards={coralTwo.map((card) => ({
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
                        cards={moss
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
                        cards={coralTwo.map((card) => ({
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
                        cards={coralTwo.map((card) => ({
                            ...card,
                            color: 'lagoon',
                        }))}
                    />
                </Example>
            </div>
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
                        cards={coral.map((card) => ({ ...card, color: 'sun' }))}
                        canEdit
                        votes={{ total: 4, mine: 1 }}
                        onUngroup={noop}
                    />
                </div>
            </Example>
        </div>
    );
}
