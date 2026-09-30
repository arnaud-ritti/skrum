import { Link } from '@inertiajs/react';
import { Globe, Users } from 'lucide-react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoomSummary } from '@/types';

export function RoomCard({ room }: { room: GameRoomSummary }) {
    const { t } = useTrans();

    return (
        <Link
            href={GameRoomsController.show(room.id)}
            className="flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted"
        >
            <span className="font-medium">{room.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{room.gameLabel}</Badge>
                {room.access === 'link' ? (
                    <span className="inline-flex items-center gap-1">
                        <Globe className="size-3.5" />
                        {t('Open by link')}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {t('Team only')}
                    </span>
                )}
            </span>
            <span className="text-sm text-muted-foreground">
                {t(':players players · :rounds rounds', {
                    players: room.playersCount,
                    rounds: room.roundsCount,
                })}
            </span>
        </Link>
    );
}
