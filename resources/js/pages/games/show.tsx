import { Head } from '@inertiajs/react';
import { GameRoom } from '@/components/games/game-room';
import type { GameSnapshot } from '@/lib/games/types';

type Props = { snapshot: GameSnapshot };

export default function ShowGameRoom({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.room.name ?? ''} />
            <GameRoom snapshot={snapshot} />
        </>
    );
}
