import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ClueRow } from '@/components/games/clue-row';
import type { CanvasTool } from '@/components/games/drawing-canvas';
import { DrawingToolbar } from '@/components/games/drawing-toolbar';
import { LeaderWord, MaskedWord } from '@/components/games/leader-word';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { DrawingColor, DrawingSize, GameMask } from '@/lib/games/types';

export const group: BenchGroup = 'skrum';

const Mask: GameMask = [
    null,
    null,
    'f',
    null,
    null,
    null,
    ' ',
    null,
    'r',
    null,
    null,
    null,
];
const LongWord = 'déploiement de la plate-forme continue';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground">
                {label}
            </h3>
            {children}
        </section>
    );
}

function Toolbar({ compact }: { compact: boolean }) {
    const [tool, setTool] = useState<CanvasTool>('pen');
    const [color, setColor] = useState<DrawingColor>('apricot');
    const [size, setSize] = useState<DrawingSize>(10);
    const [strokes, setStrokes] = useState(2);

    return (
        <div className="flex min-w-0 justify-center rounded-xl bg-skrum-canvas p-4">
            <DrawingToolbar
                tool={tool}
                color={color}
                size={size}
                canUndo={strokes > 0}
                compact={compact}
                onTool={setTool}
                onColor={setColor}
                onSize={setSize}
                onUndo={() => setStrokes((current) => current - 1)}
                onClear={() => setStrokes(0)}
            />
        </div>
    );
}

export default function GamesDrawSection() {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 flex-col gap-10">
            <State label={t('Drawing tools')}>
                <Toolbar compact={false} />
                <div className="max-w-90">
                    <Toolbar compact />
                </div>
            </State>
            <State label={t('Your word to draw')}>
                <div className="flex min-w-0 flex-col items-center gap-4 rounded-xl bg-skrum-canvas p-4">
                    <LeaderWord
                        word="coffee break"
                        label={t('Your word to draw')}
                        action={
                            <Button type="button" size="sm" variant="ghost">
                                {t('Reveal a letter (:count left)', {
                                    count: 2,
                                })}
                            </Button>
                        }
                    />
                    <LeaderWord
                        word={LongWord}
                        label={t('Your word to describe')}
                    />
                    <LeaderWord word={null} label={t('Your word to draw')} />
                    <MaskedWord mask={Mask} maxHints={5} />
                </div>
            </State>
            <State label={t('Decoded')}>
                <div className="flex min-w-0 flex-col items-center gap-4 rounded-xl bg-skrum-canvas p-4">
                    <ClueRow clue={['☕', '🥐', '⏸️']} />
                    <div className="@container w-full max-w-2xl">
                        <ClueRow clue={['🚀', '🌕']} size="lg" />
                    </div>
                    <div className="@container w-full max-w-80">
                        <ClueRow
                            clue={['🚀', '🌕', '🧊', '🔨', '🎉']}
                            size="lg"
                        />
                    </div>
                    <ClueRow clue={[]} />
                </div>
            </State>
        </div>
    );
}
