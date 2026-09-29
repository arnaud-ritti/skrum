import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';
import { DeleteRetroDialog } from './delete-retro-dialog';
import { GuestLinkDialog } from './guest-link-dialog';
import { HandoverDialog } from './handover-dialog';
import { SettingsDialog } from './settings-dialog';

type OpenDialog = 'settings' | 'guests' | 'handover' | 'delete' | null;

export function FacilitatorMenu() {
    const { t } = useTrans();
    const { sessionExpired } = useBoard();
    const [chosen, setChosen] = useState<OpenDialog>(null);
    const open = sessionExpired ? null : chosen;
    const close = (isOpen: boolean) => {
        if (!isOpen) {
            setChosen(null);
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
                    <DropdownMenuItem onSelect={() => setChosen('settings')}>
                        {t('Settings…')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setChosen('guests')}>
                        {t('Guest link…')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setChosen('handover')}>
                        {t('Hand over facilitation…')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setChosen('delete')}
                    >
                        {t('Delete retrospective…')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SettingsDialog open={open === 'settings'} onOpenChange={close} />
            <GuestLinkDialog open={open === 'guests'} onOpenChange={close} />
            <HandoverDialog open={open === 'handover'} onOpenChange={close} />
            <DeleteRetroDialog open={open === 'delete'} onOpenChange={close} />
        </>
    );
}
