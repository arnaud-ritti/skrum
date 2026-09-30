import { useTrans } from '@/hooks/use-trans';
import type { PokerRound } from '@/lib/poker/types';
import { PokerCard } from './poker-card';

/**
 * Values of an anonymous round, in deck order and without names, so no
 * position links a value to a player.
 */
export function AnonymousValuesRow({ round }: { round: PokerRound }) {
    const { t } = useTrans();
    const values = (round.result?.distribution ?? []).flatMap(
        ({ value, count }) => Array.from({ length: count }, () => value),
    );

    return (
        <section aria-label={t('Anonymous votes')} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Anonymous votes')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {values.map((value, index) => (
                    <PokerCard
                        key={`${value}-${index}`}
                        value={value}
                        face="up"
                    />
                ))}
            </div>
        </section>
    );
}
