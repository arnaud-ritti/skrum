import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import GameGuestTokensController from '@/actions/App/Http/Controllers/Games/GameGuestTokensController';
import GameHostsController from '@/actions/App/Http/Controllers/Games/GameHostsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { DeleteRoomDialog } from './delete-room-dialog';
import { useRoom } from './room-context';
import { RoomSettingsDialog } from './room-settings-dialog';

type OpenDialog = 'settings' | 'delete' | null;

export function RoomMenu() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<OpenDialog>(null);
    const { room, me, players } = ctx.snapshot;
    const open = ctx.sessionExpired ? null : chosen;
    const hostCandidates = players.filter(
        (player) => !player.isGuest && player.id !== me.playerId,
    );

    if (
        room.isIcebreaker ||
        (!room.canManage && !room.canDelete && !room.canBecomeHost)
    ) {
        return null;
    }

    const setHost = async (playerId: string) => {
        const result = await ctx.run(
            retroRequest(GameHostsController.update(room.id), {
                player_id: playerId,
            }),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    const regenerateLink = async () => {
        const result = await ctx.run(
            retroRequest<{ guestUrl: string | null }>(
                GameGuestTokensController.store(room.id),
            ),
        );

        if (result) {
            toast(
                t('A new guest link was created. The old one no longer works.'),
            );
            await ctx.refetch();
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Room menu')}
                    >
                        <Settings2 className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {room.canManage && (
                        <DropdownMenuItem
                            onSelect={() => setChosen('settings')}
                        >
                            {t('Room settings')}
                        </DropdownMenuItem>
                    )}
                    {room.canManage && room.access === 'link' && (
                        <DropdownMenuItem
                            onSelect={() => void regenerateLink()}
                        >
                            {t('Regenerate guest link')}
                        </DropdownMenuItem>
                    )}
                    {room.isHost && hostCandidates.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                {t('Hand over hosting')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {hostCandidates.map((player) => (
                                    <DropdownMenuItem
                                        key={player.id}
                                        onSelect={() => void setHost(player.id)}
                                    >
                                        {player.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {room.canBecomeHost && (
                        <DropdownMenuItem
                            onSelect={() => void setHost(me.playerId)}
                        >
                            {t('Become host')}
                        </DropdownMenuItem>
                    )}
                    {room.canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setChosen('delete')}
                            >
                                {t('Delete room')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <RoomSettingsDialog
                open={open === 'settings'}
                onOpenChange={(next) => setChosen(next ? 'settings' : null)}
            />
            <DeleteRoomDialog
                open={open === 'delete'}
                onOpenChange={(next) => setChosen(next ? 'delete' : null)}
            />
        </>
    );
}
