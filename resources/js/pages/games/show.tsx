import { Head } from '@inertiajs/react';
import { GameRoom } from '@/components/games/game-room';
import { useTrans } from '@/hooks/use-trans';
import type { GameSnapshot } from '@/lib/games/types';

type Props = { snapshot: GameSnapshot };

export default function ShowGameRoom({ snapshot }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={snapshot.room.name ?? t('Game')} />
            <GameRoom snapshot={snapshot} />
        </>
    );
}
