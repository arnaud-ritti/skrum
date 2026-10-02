import { Head } from '@inertiajs/react';
import { PokerRoom } from '@/components/poker/poker-room';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PokerDeckOption } from '@/types';

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

export default function ShowPokerGame({ snapshot, deckOptions }: Props) {
    return (
        <>
            <Head title={snapshot.game.title} />
            <PokerRoom snapshot={snapshot} deckOptions={deckOptions} />
        </>
    );
}
