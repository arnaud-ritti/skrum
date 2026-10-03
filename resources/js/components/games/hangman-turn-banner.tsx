import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** Whose turn it is in a hangman round played in turns (spec §9.4, the mockup's `ib-turn`). */
export function HangmanTurnBanner({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();

    if (round.turnOrder.length === 0) {
        return null;
    }

    const player =
        snapshot.players.find((known) => known.id === round.turnPlayerId) ??
        null;
    const name = player?.name ?? t('Someone');
    const isMine = round.turnPlayerId === snapshot.me.playerId;

    return (
        <div
            data-slot="hangman-turn-banner"
            data-mine={isMine}
            role="status"
            className={cn(
                'flex max-w-full items-center gap-3 rounded-full py-2.5 pr-4 pl-2.5 font-semibold',
                isMine
                    ? 'bg-skrum-primary-soft text-skrum-primary-text'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <PersonAvatar
                name={name}
                src={player?.avatarUrl}
                kind={player?.isGuest ? 'guest' : 'member'}
                size="sm"
            />
            <span className="min-w-0 break-words">
                {isMine
                    ? t('Your turn, :name — pick a letter', { name })
                    : t(":name's turn", { name })}
            </span>
        </div>
    );
}
