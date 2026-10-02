import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { GifStepLine, GifSteps } from '@/components/games/gif-steps';
import { GifTile } from '@/components/games/gif-tile';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameGif } from '@/lib/games/types';

export const group: BenchGroup = 'skrum';

/** A blank picture: the bench has no GIF provider. */
const Blank =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const Gif: GameGif = { id: 'bench', previewUrl: Blank, url: Blank };
const LongName = 'Maximilian Alexander von Hohenberg-Lichtenstein';

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

export default function GamesGifSection() {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 flex-col gap-10">
            <State label={t('Sprint in one GIF')}>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] items-start gap-4 rounded-xl bg-skrum-canvas p-4">
                    <li className="min-w-0">
                        <GifTile
                            gif={Gif}
                            caption={t('by :name', { name: 'Malik' })}
                            author={{
                                name: 'Malik',
                                avatarUrl: '',
                                isGuest: false,
                            }}
                            winner
                        >
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                {t('Votes: :count', { count: 5 })}
                                <Badge variant="success" shape="pill">
                                    +10
                                </Badge>
                            </div>
                        </GifTile>
                    </li>
                    <li className="min-w-0">
                        <GifTile
                            gif={Gif}
                            caption={t('by :name', { name: LongName })}
                            author={{
                                name: LongName,
                                avatarUrl: '',
                                isGuest: true,
                            }}
                            highlight
                        />
                    </li>
                    <li className="min-w-0">
                        <GifTile gif={Gif} caption={t('Anonymous GIF')} />
                    </li>
                    <li className="min-w-0">
                        <GifTile gif={Gif} caption={t('Your GIF')} />
                    </li>
                </ul>
            </State>
            <State label={t('How it works')}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
                    {([0, 1, 2, 3] as const).map((step) => (
                        <div
                            key={step}
                            className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4"
                        >
                            {step > 0 && (
                                <GifStepLine step={step as 1 | 2 | 3} />
                            )}
                            <GifSteps step={step} />
                        </div>
                    ))}
                </div>
            </State>
        </div>
    );
}
