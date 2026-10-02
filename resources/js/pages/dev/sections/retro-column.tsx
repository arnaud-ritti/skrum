import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { columnColors } from '@/components/skrum/column-color-picker';
import { RetroCard } from '@/components/skrum/retro-card';
import { RetroColumn } from '@/components/skrum/retro-column';
import type { ColumnColor } from '@/components/skrum/retro-column';
import { TooltipProvider } from '@/components/ui/tooltip';
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

function Cards({
    color,
    texts,
    scope = color,
}: {
    color: ColumnColor;
    texts: string[];
    scope?: string;
}) {
    return (
        <>
            {texts.map((text, index) => (
                <RetroCard
                    key={`${scope}-${index}`}
                    id={`${scope}-${index}`}
                    text={text}
                    color={color}
                    author={{
                        id: `u${index}`,
                        name: 'Camille Roux',
                        presence: 4,
                    }}
                    votes={{ total: index + 1, mine: 0 }}
                />
            ))}
        </>
    );
}

function FacilitatorColumn() {
    const { t } = useTrans();
    const [title, setTitle] = useState(t('What went well'));
    const [color, setColor] = useState<ColumnColor>('moss');
    const [description, setDescription] = useState<string | null>(
        t('Write what worked well during the sprint.'),
    );
    const [deleted, setDeleted] = useState(false);

    if (deleted) {
        return (
            <p className="w-column text-sm text-muted-foreground">
                {t('Column deleted.')}
            </p>
        );
    }

    return (
        <RetroColumn
            id="b-facilitator"
            title={title}
            color={color}
            count={0}
            description={description}
            canMoveLeft={false}
            onAdd={noop}
            onRename={setTitle}
            onColorChange={setColor}
            onDescriptionChange={setDescription}
            onMove={noop}
            onDelete={() => setDeleted(true)}
        />
    );
}

function SortableColumn({ texts }: { texts: string[] }) {
    const { t } = useTrans();
    const [sorted, setSorted] = useState(true);

    return (
        <RetroColumn
            id="b-sorted"
            title={t('To improve')}
            color="coral"
            count={texts.length}
            canAdd={false}
            sortedByVotes={sorted}
            onSortByVotesChange={setSorted}
        >
            <Cards
                color="coral"
                scope="sorted"
                texts={sorted ? [...texts].reverse() : texts}
            />
        </RetroColumn>
    );
}

export default function RetroColumnSection() {
    const { t } = useTrans();
    const wellTexts = [
        t('The client demo went really well.'),
        t('Thursday pair programming was very effective.'),
    ];
    const paletteTitles = [
        t('Thanks'),
        t('Keep going'),
        t('Stop'),
        t('Risks'),
        t('Questions'),
        t('Ideas'),
        t('Learn'),
        t('Wins'),
    ];
    const longDescription = `${t('Write what worked well during the sprint.')} `
        .repeat(6)
        .slice(0, 200);
    const longTitle = `${t('What went well')} `.repeat(8).slice(0, 100);
    const manyTexts = Array.from(
        { length: 200 },
        (_, index) => `${wellTexts[index % 2]} (${index + 1})`,
    );

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-8 p-4 md:p-6">
                <div className="flex items-start gap-5 overflow-x-auto pb-2 *:shrink-0">
                    <Example
                        label={t(
                            'With cards: menu open, structure locked with its reason',
                        )}
                    >
                        <RetroColumn
                            id="b-cards"
                            title={t('What went well')}
                            color="moss"
                            count={2}
                            description={t(
                                'Write what worked well during the sprint.',
                            )}
                            editDisabledReason={t(
                                'Only empty columns can be renamed, recoloured or deleted.',
                            )}
                            canMoveRight={false}
                            defaultMenuOpen
                            onAdd={noop}
                            onRename={noop}
                            onColorChange={noop}
                            onDescriptionChange={noop}
                            onMove={noop}
                            onDelete={noop}
                        >
                            <Cards color="moss" texts={wellTexts} />
                        </RetroColumn>
                    </Example>
                    <Example
                        label={t(
                            'Empty column, facilitator menu: rename, describe, recolour, move, delete',
                        )}
                    >
                        <FacilitatorColumn />
                    </Example>
                    <Example label={t('Sort by votes toggle (discussion)')}>
                        <SortableColumn texts={wellTexts} />
                    </Example>
                    <Example label={t('Drop zone active')}>
                        <RetroColumn
                            id="b-drop"
                            title={t('To improve')}
                            color="coral"
                            count={1}
                            isDropTarget
                            onAdd={noop}
                        >
                            <Cards
                                color="coral"
                                texts={[
                                    t(
                                        'Scope changes in the middle of a sprint.',
                                    ),
                                ]}
                            />
                        </RetroColumn>
                    </Example>
                    <Example label={t('Empty')}>
                        <RetroColumn
                            id="b-empty"
                            title={t('Ideas to try')}
                            color="sky"
                            count={0}
                            onAdd={noop}
                        />
                    </Example>
                    <Example label={t('Empty, custom hint')}>
                        <RetroColumn
                            id="b-hint"
                            title={t('Questions')}
                            color="iris"
                            count={0}
                            emptyHint={t('Nobody asked a question yet.')}
                            onAdd={noop}
                        />
                    </Example>
                    <Example label={t('Adding disabled: board locked')}>
                        <RetroColumn
                            id="b-locked"
                            title={t('Risks')}
                            color="plum"
                            count={2}
                            canAdd={false}
                        >
                            <Cards color="plum" texts={wellTexts} />
                        </RetroColumn>
                    </Example>
                    <Example
                        label={t('Slots: header action, notice and footer')}
                    >
                        <RetroColumn
                            id="b-slots"
                            title={t('Questions')}
                            color="plum"
                            count={1}
                            canAdd={false}
                            headerAction={
                                <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                                    {t('Header slot')}
                                </span>
                            }
                            notice={
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Drag cards onto each other to group them.',
                                    )}
                                </p>
                            }
                            footer={
                                <p className="rounded-lg border border-dashed border-input p-3 text-xs text-muted-foreground">
                                    {t('Footer slot')}
                                </p>
                            }
                        >
                            <Cards color="plum" texts={wellTexts.slice(0, 1)} />
                        </RetroColumn>
                    </Example>
                </div>
                <div className="flex items-start gap-5 overflow-x-auto pb-2 *:shrink-0">
                    <Example
                        label={t(
                            '200 cards inside the column scroller (40rem)',
                        )}
                    >
                        <div className="flex h-160 flex-col">
                            <RetroColumn
                                id="b-many"
                                title={t('What went well')}
                                color="sky"
                                count={200}
                                sortedByVotes
                                onAdd={noop}
                                onSortByVotesChange={noop}
                            >
                                <Cards color="sky" texts={manyTexts} />
                            </RetroColumn>
                        </div>
                    </Example>
                    <Example
                        label={t(
                            '100-character title and 200-character description',
                        )}
                    >
                        <RetroColumn
                            id="b-long"
                            title={longTitle}
                            color="sun"
                            count={1}
                            description={longDescription}
                            onAdd={noop}
                            onRename={noop}
                            onDescriptionChange={noop}
                        >
                            <Cards color="sun" texts={wellTexts.slice(0, 1)} />
                        </RetroColumn>
                    </Example>
                    <Example label={t('One card')}>
                        <RetroColumn
                            id="b-one"
                            title={t('Ideas')}
                            color="iris"
                            count={1}
                            onAdd={noop}
                        >
                            <Cards color="iris" texts={wellTexts.slice(0, 1)} />
                        </RetroColumn>
                    </Example>
                </div>
                <Example label={t('Palette of the eight colours')}>
                    <div className="flex items-start gap-5 overflow-x-auto pb-2">
                        {columnColors.map((value, index) => (
                            <RetroColumn
                                key={value}
                                id={`b-${value}`}
                                title={paletteTitles[index]}
                                color={value}
                                count={0}
                                canAdd={false}
                                emptyHint={value}
                            />
                        ))}
                    </div>
                </Example>
            </div>
        </TooltipProvider>
    );
}
