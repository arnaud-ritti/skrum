import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import PokerStatusesController from '@/actions/App/Http/Controllers/Poker/PokerStatusesController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { DeleteGameDialog } from './delete-game-dialog';
import { useGame } from './game-context';
import { GameGuestLinkDialog } from './game-guest-link-dialog';
import { GameShareDialog } from './game-share-dialog';
import { GameSettingsDialog } from './game-settings-dialog';
import { TransferDialog } from './transfer-dialog';

type OpenDialog =
    | 'settings'
    | 'guests'
    | 'transfer'
    | 'end'
    | 'delete'
    | 'share'
    | null;

export function GameMenu() {
    const ctx = useGame();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<OpenDialog>(null);
    const [busy, setBusy] = useState(false);
    const { game, me, share } = ctx.snapshot;
    const open = ctx.sessionExpired ? null : chosen;
    const isEnded = game.endedAt !== null;
    const canShare = share.slack || share.telegram;

    if (!me.isFacilitator && !me.canDelete) {
        return null;
    }

    const close = (isOpen: boolean) => {
        if (!isOpen) {
            setChosen(null);
        }
    };

    const setEnded = async (ended: boolean) => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerStatusesController.update(game.id), { ended }),
        );

        setBusy(false);

        if (result !== undefined) {
            setChosen(null);
            await ctx.refetch();
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        aria-label={t('Facilitator menu')}
                    >
                        <Settings2 className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {canShare && (
                        <>
                            <DropdownMenuItem
                                onSelect={() => setChosen('share')}
                            >
                                {t('Share…')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {me.isFacilitator && (
                        <>
                            {!isEnded && (
                                <>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('settings')}
                                    >
                                        {t('Settings…')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('guests')}
                                    >
                                        {t('Guest link…')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('transfer')}
                                    >
                                        {t('Hand over facilitation…')}
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isEnded ? (
                                <DropdownMenuItem
                                    disabled={busy}
                                    onSelect={() => void setEnded(false)}
                                >
                                    {t('Reopen game')}
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onSelect={() => setChosen('end')}
                                >
                                    {t('End game')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    {me.canDelete && (
                        <>
                            {me.isFacilitator && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setChosen('delete')}
                            >
                                {t('Delete game…')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <GameSettingsDialog
                open={open === 'settings'}
                onOpenChange={close}
            />
            <GameGuestLinkDialog
                open={open === 'guests'}
                onOpenChange={close}
            />
            <GameShareDialog open={open === 'share'} onOpenChange={close} />
            <TransferDialog open={open === 'transfer'} onOpenChange={close} />
            <DeleteGameDialog open={open === 'delete'} onOpenChange={close} />
            <Dialog open={open === 'end'} onOpenChange={close}>
                <DialogContent>
                    <DialogTitle>{t('End this game?')}</DialogTitle>
                    <DialogDescription>
                        {t('It becomes read-only until reopened.')}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setChosen(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => void setEnded(true)}
                        >
                            {t('End game')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
