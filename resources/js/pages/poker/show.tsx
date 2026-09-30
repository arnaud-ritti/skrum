import { Head } from '@inertiajs/react';
import { Game } from '@/components/poker/game';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PokerDeckOption } from '@/types';

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

export default function ShowPokerGame({ snapshot, deckOptions }: Props) {
    return (
        <>
            <Head title={snapshot.game.title} />
            <Game snapshot={snapshot} deckOptions={deckOptions} />
        </>
    );
}
