import type { GameGifRevealed } from '@/lib/games/types';
import { useRoom } from './room-context';
import { useEndedRoundDetail } from './use-ended-round-detail';

/**
 * The closed GIFs of the room's last round between two rounds: from the end of
 * the round when it was seen live, else from its detail.
 */
export function useEndedGifAnswers(): GameGifRevealed[] | null {
    const { lastEnded } = useRoom();
    const detail = useEndedRoundDetail('gif', Boolean(lastEnded?.answers));

    return lastEnded?.answers ?? detail?.answers ?? null;
}
