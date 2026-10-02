import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    IcebreakerGameCard,
    IcebreakerGameGrid,
} from '@/components/skrum/icebreaker-game-card';
import type { IcebreakerGame } from '@/components/skrum/icebreaker-game-card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
                {label}
            </h3>
            {children}
        </section>
    );
}

export default function IcebreakerGameCardSection() {
    const { t } = useTrans();
    const [chosen, setChosen] = useState<IcebreakerGame>('draw');

    const hangman = {
        game: 'hangman' as const,
        title: t('Hangman'),
        pitch: t("Guess the team's word, letter by letter."),
        color: 'sun' as const,
        durationMin: 5,
        players: { min: 2, max: 30 },
        participants: 8,
    };
    const draw = {
        game: 'draw' as const,
        title: t('Draw & Guess'),
        pitch: t('One draws, the others guess within 60 seconds.'),
        color: 'sky' as const,
        durationMin: 10,
        players: { min: 3, max: 12 },
        participants: 8,
    };
    const gif = {
        game: 'gif' as const,
        title: t('Sprint in one GIF'),
        pitch: t('Sum up the sprint with a single GIF.'),
        color: 'lagoon' as const,
        durationMin: 10,
        players: { min: 2, max: 30 },
        participants: 8,
    };
    const decoded = {
        game: 'decoded' as const,
        title: t('Decoded'),
        pitch: t('A film, a place or a project hidden in 3 emojis.'),
        color: 'apricot' as const,
        durationMin: 5,
        players: { min: 2, max: 30 },
        participants: 8,
    };

    const games = [hangman, draw, gif, decoded];

    return (
        <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <State label={t('Default')}>
                    <IcebreakerGameCard {...hangman} />
                </State>
                <State label={t('Selected')}>
                    <IcebreakerGameCard {...draw} selected />
                </State>
                <State label={t('Hover')}>
                    <IcebreakerGameCard
                        {...decoded}
                        className="-translate-y-0.5 shadow-raised"
                    />
                </State>
                <State label={t('Unavailable (min. 3 players)')}>
                    <IcebreakerGameCard
                        {...gif}
                        players={{ min: 3, max: 15 }}
                        participants={2}
                    />
                </State>
                <State label={t('Unavailable (max. 12 players)')}>
                    <IcebreakerGameCard {...draw} participants={14} />
                </State>
                <State label={t('Server option only (kind and label)')}>
                    <IcebreakerGameCard
                        game="decoded"
                        title={t('Decoded')}
                        available
                    />
                </State>
                <State label={t('Refused by the server (no GIF provider)')}>
                    <IcebreakerGameCard
                        {...gif}
                        available={false}
                        unavailableReason={t('No GIF provider configured')}
                    />
                </State>
                <State label={t('Refused by the server, no reason given')}>
                    <IcebreakerGameCard
                        game="gif"
                        title={t('Sprint in one GIF')}
                        available={false}
                    />
                </State>
                <State label={t('Long text')}>
                    <IcebreakerGameCard
                        {...hangman}
                        title={t(
                            'A very long icebreaker name that must truncate instead of wrapping',
                        )}
                        pitch={t(
                            'A pitch that keeps going well past two lines so that the clamp cuts it short and the card keeps its height under control.',
                        )}
                        color="plum"
                    />
                </State>
            </div>
            <State label={t('One game offered')}>
                <IcebreakerGameGrid>
                    <IcebreakerGameCard
                        game="hangman"
                        title={t('Hangman')}
                        available
                        selected
                    />
                </IcebreakerGameGrid>
            </State>
            <State label={t('In play')}>
                <IcebreakerGameGrid className="max-w-80 grid-cols-2 gap-3 sm:grid-cols-2">
                    <IcebreakerGameCard
                        game="hangman"
                        title={t('Hangman')}
                        compact
                        selected
                        inPlay
                    />
                    <IcebreakerGameCard
                        game="draw"
                        title={t('Draw & Guess')}
                        compact
                        inPlay
                    />
                </IcebreakerGameGrid>
            </State>
            <State label={t('Choose an icebreaker')}>
                <IcebreakerGameGrid>
                    {games.map((game) => (
                        <IcebreakerGameCard
                            key={game.game}
                            {...game}
                            participants={game.game === 'gif' ? 1 : 8}
                            players={
                                game.game === 'gif'
                                    ? { min: 3, max: 15 }
                                    : game.players
                            }
                            selected={chosen === game.game}
                            onSelect={setChosen}
                        />
                    ))}
                </IcebreakerGameGrid>
            </State>
        </div>
    );
}
