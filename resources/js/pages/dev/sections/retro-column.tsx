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

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Cards({ color, texts }: { color: ColumnColor; texts: string[] }) {
    return (
        <>
            {texts.map((text, index) => (
                <RetroCard
                    key={text}
                    id={`${color}-${index}`}
                    text={text}
                    color={color}
                    author={{
                        id: `u${index}`,
                        name: 'Camille Roux',
                        initials: 'CR',
                        presence: 4,
                    }}
                    votes={{ total: index + 1, mine: 0 }}
                />
            ))}
        </>
    );
}

export default function RetroColumnSection() {
    const { t } = useTrans();
    const [title, setTitle] = useState(t('What went well'));
    const [color, setColor] = useState<ColumnColor>('moss');
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

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-8 p-4 md:p-6">
                <div className="flex items-start gap-5 overflow-x-auto pb-2 *:shrink-0">
                    <Example label={t('With cards, facilitator menu')}>
                        <RetroColumn
                            id="b-cards"
                            title={title}
                            color={color}
                            count={2}
                            description={t(
                                'Write what worked well during the sprint.',
                            )}
                            onAdd={() => {}}
                            onRename={setTitle}
                            onColorChange={setColor}
                            onSort={() => {}}
                        >
                            <Cards color={color} texts={wellTexts} />
                        </RetroColumn>
                    </Example>
                    <Example label={t('Drop zone active')}>
                        <RetroColumn
                            id="b-drop"
                            title={t('To improve')}
                            color="coral"
                            count={1}
                            isDropTarget
                            onAdd={() => {}}
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
                            onAdd={() => {}}
                        />
                    </Example>
                    <Example label={t('Empty, custom hint')}>
                        <RetroColumn
                            id="b-hint"
                            title={t('Questions')}
                            color="iris"
                            count={0}
                            emptyHint={t('Nobody asked a question yet.')}
                            onAdd={() => {}}
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
