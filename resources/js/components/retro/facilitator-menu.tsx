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
import type { BoardContextValue } from './board';
import { DeleteRetroDialog } from './delete-retro-dialog';
import { GuestLinkDialog } from './guest-link-dialog';
import { HandoverDialog } from './handover-dialog';
import { SettingsDialog } from './settings-dialog';

type OpenDialog = 'settings' | 'guests' | 'handover' | 'delete' | null;

export function FacilitatorMenu({ ctx }: { ctx: BoardContextValue }) {
    const { t } = useTrans();
    const [open, setOpen] = useState<OpenDialog>(null);
    const close = (isOpen: boolean) => {
        if (!isOpen) {
            setOpen(null);
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
                    <DropdownMenuItem onSelect={() => setOpen('settings')}>
                        {t('Settings…')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setOpen('guests')}>
                        {t('Guest link…')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setOpen('handover')}>
                        {t('Hand over facilitation…')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setOpen('delete')}
                    >
                        {t('Delete retrospective…')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SettingsDialog
                ctx={ctx}
                open={open === 'settings'}
                onOpenChange={close}
            />
            <GuestLinkDialog
                ctx={ctx}
                open={open === 'guests'}
                onOpenChange={close}
            />
            <HandoverDialog
                ctx={ctx}
                open={open === 'handover'}
                onOpenChange={close}
            />
            <DeleteRetroDialog
                ctx={ctx}
                open={open === 'delete'}
                onOpenChange={close}
            />
        </>
    );
}
