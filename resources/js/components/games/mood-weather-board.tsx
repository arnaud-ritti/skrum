import { CloudSun, VenetianMask } from 'lucide-react';
import { useState } from 'react';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import { MoodThreshold, MoodWeathers, weatherLabel } from '@/lib/games/mood';
import type {
    GameRound,
    GameRoundEnded,
    GameWeather,
    GameWeatherCount,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
import { useRoundChoice } from './use-round-choice';

function isWeather(value: unknown): value is GameWeather {
    return MoodWeathers.some((weather) => weather.value === value);
}

/** A round in play (spec §9.8): everyone picks a weather, nobody sees whose. */
export function MoodWeatherBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me } = ctx.snapshot;
    const myChoice = isWeather(round.myChoice) ? round.myChoice : null;
    const answered = pendingAnswers(round).length;
    const choice = useRoundChoice<GameWeather>({
        round,
        current: myChoice,
        onSent: (sent) =>
            ctx.dispatch({
                type: 'answer.changed',
                roundId: round.id,
                playerId: me.playerId,
                answered: sent !== null,
            }),
    });

    const reveal = async () => {
        setBusy(true);

        let response: { ended?: GameRoundEnded | null } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended?: GameRoundEnded | null }>(
                    GameRevealsController.store({
                        room: room.id,
                        round: round.id,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response?.ended) {
            return;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();
    };

    return (
        <section
            data-slot="mood-weather-board"
            aria-labelledby="mood-weather-prompt"
            className="flex w-full max-w-2xl flex-col items-center gap-4"
        >
            <h3
                id="mood-weather-prompt"
                className="text-center font-display text-xl font-title"
            >
                {t("What's the weather of your mood?")}
            </h3>
            <Badge variant="secondary" shape="pill">
                <VenetianMask aria-hidden />
                {t('Answers are anonymous.')}
            </Badge>
            <RadioGroup
                aria-labelledby="mood-weather-prompt"
                value={myChoice ?? ''}
                className="grid w-full grid-cols-3 gap-3 sm:grid-cols-5"
                {...choice.groupProps}
            >
                {MoodWeathers.map(({ value, icon: Icon }) => (
                    <RadioGroupCardItem
                        key={value}
                        value={value}
                        aria-disabled={choice.busy || undefined}
                        onClick={() => choice.choose(value)}
                        className="min-h-11 items-center justify-center gap-2 p-3 text-center aria-disabled:cursor-progress"
                    >
                        <Icon aria-hidden className="size-10 text-primary" />
                        <span className="text-sm font-medium">
                            {weatherLabel(value, t)}
                        </span>
                    </RadioGroupCardItem>
                ))}
            </RadioGroup>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm font-medium">
                    {t(':count answered', { count: answered })}
                </p>
                {room.isHost && (
                    <Button
                        disabled={busy || choice.busy}
                        onClick={() => void reveal()}
                    >
                        <CloudSun aria-hidden />
                        {t('Show the weather')}
                    </Button>
                )}
            </div>
        </section>
    );
}

type MoodWeatherResultProps = {
    answered: number;
    /** Null under the threshold: the server keeps the weather back. */
    weather: GameWeatherCount[] | null;
};

/** After the reveal: how many picked each weather, never who. */
export function MoodWeatherResult({
    answered,
    weather,
}: MoodWeatherResultProps) {
    const { t } = useTrans();

    if (weather === null) {
        return (
            <p
                data-slot="mood-weather-result"
                className="text-sm text-muted-foreground"
            >
                {t('Not enough answers to show the weather (:count needed).', {
                    count: MoodThreshold,
                })}
            </p>
        );
    }

    return (
        <div
            data-slot="mood-weather-result"
            className="flex w-full flex-col gap-3 text-left"
        >
            <ul className="flex flex-col gap-3">
                {weather.map(({ weather: value, count }) => (
                    <li key={value}>
                        <Progress
                            label={weatherLabel(value, t)}
                            value={count}
                            max={Math.max(answered, 1)}
                            valueLabel={String(count)}
                            tone="primary"
                        />
                    </li>
                ))}
            </ul>
            <p className="text-sm text-muted-foreground">
                {t(':count answered', { count: answered })}
            </p>
        </div>
    );
}
