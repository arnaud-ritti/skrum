import { Crown, Settings, Trash2, UserRoundCog } from 'lucide-react';
import { useState } from 'react';
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

/** The guest link is not here: it lives in the Share dialog, behind "Invite". */
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

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t('Room menu')}
                        disabled={ctx.sessionExpired}
                    >
                        <Settings aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" size="wide">
                    {room.canManage && (
                        <DropdownMenuItem
                            onSelect={() => setChosen('settings')}
                        >
                            <Settings aria-hidden />
                            <span className="truncate">
                                {t('Room settings')}
                            </span>
                        </DropdownMenuItem>
                    )}
                    {room.isHost && hostCandidates.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <UserRoundCog aria-hidden />
                                <span className="truncate">
                                    {t('Hand over hosting')}
                                </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {hostCandidates.map((player) => (
                                    <DropdownMenuItem
                                        key={player.id}
                                        onSelect={() => void setHost(player.id)}
                                    >
                                        <span className="truncate">
                                            {player.name}
                                        </span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {room.canBecomeHost && (
                        <DropdownMenuItem
                            onSelect={() => void setHost(me.playerId)}
                        >
                            <Crown aria-hidden />
                            <span className="truncate">{t('Become host')}</span>
                        </DropdownMenuItem>
                    )}
                    {room.canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setChosen('delete')}
                            >
                                <Trash2 aria-hidden />
                                <span className="truncate">
                                    {t('Delete room')}
                                </span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {open === 'settings' && (
                <RoomSettingsDialog
                    open
                    onOpenChange={(next) => setChosen(next ? 'settings' : null)}
                />
            )}
            <DeleteRoomDialog
                open={open === 'delete'}
                onOpenChange={(next) => setChosen(next ? 'delete' : null)}
            />
        </>
    );
}
