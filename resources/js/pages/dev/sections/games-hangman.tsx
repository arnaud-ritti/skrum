import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { HangmanFigure } from '@/components/games/hangman-figure';
import { LetterKeyboard } from '@/components/games/letter-keyboard';
import { PlayerPoints, PlayerRow } from '@/components/games/player-row';
import { WordMask } from '@/components/games/word-mask';
import { useTrans } from '@/hooks/use-trans';
import { hitLetters } from '@/lib/games/hangman';
import type { KeyboardLayout } from '@/lib/games/hangman';
import type { GameMask } from '@/lib/games/types';

export const group: BenchGroup = 'skrum';

const Word = 'déploiement de la plate-forme';
const Layouts: KeyboardLayout[] = ['azerty', 'qwertz', 'qwerty'];
const LongName = 'Maximilian Alexander von Hohenberg-Lichtenstein';

function maskOf(picked: string[]): GameMask {
    return Word.split('').map((character) => {
        if (character === ' ' || character === '-') {
            return character;
        }

        return hitLetters([character], picked).length > 0 ? character : null;
    });
}

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

export default function GamesHangmanSection() {
    const { t } = useTrans();
    const [picked, setPicked] = useState(['a', 'e', 'r', 't', 's', 'o']);
    const mask = maskOf(picked);
    const hits = hitLetters(mask, picked);
    const misses = picked.length - hits.length;

    return (
        <div className="flex min-w-0 flex-col gap-10">
            <State label={t('Hangman')}>
                <div className="flex min-w-0 flex-col items-center gap-5 rounded-xl bg-skrum-canvas p-4">
                    <HangmanFigure misses={Math.min(misses, 6)} maxMisses={6} />
                    <WordMask mask={mask} size="lg" />
                    <WordMask mask={mask} />
                </div>
            </State>
            {Layouts.map((layout) => (
                <State key={layout} label={layout.toUpperCase()}>
                    <div className="flex min-w-0 justify-center rounded-xl bg-skrum-canvas p-4">
                        <LetterKeyboard
                            layout={layout}
                            picked={picked}
                            hits={hits}
                            disabled={false}
                            onPick={(letter) =>
                                setPicked((current) => [...current, letter])
                            }
                        />
                    </div>
                </State>
            ))}
            <State label={t('Players')}>
                <ol className="flex max-w-80 min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-3">
                    <PlayerRow
                        name="Camille Roux"
                        avatarUrl={null}
                        isGuest={false}
                        rank={1}
                        trailing={<PlayerPoints points={60} />}
                    />
                    <PlayerRow
                        name={LongName}
                        avatarUrl={null}
                        isGuest
                        isMe
                        rank={2}
                        detail={t('Guest')}
                        trailing={<PlayerPoints points={1480} />}
                    />
                    <PlayerRow
                        name="Yuki Tanaka"
                        avatarUrl={null}
                        isGuest
                        offline
                        rank={3}
                        trailing={<PlayerPoints points={0} />}
                    />
                </ol>
            </State>
        </div>
    );
}
