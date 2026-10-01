import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import {
    hasShareChannel,
    ShareChannels,
    shareResultsLabel,
} from '@/lib/integrations';
import type { ShareChannel } from '@/types';
import { useBoard } from '../board-context';
import { EmailResultsDialog } from './email-results-dialog';
import { RecapShareDialog } from './recap-share-dialog';

type OpenDialog = { kind: 'recap'; channel: ShareChannel } | { kind: 'email' };

export function ResultsShareMenu() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState<OpenDialog | null>(null);
    const { integrations } = board;

    if (!hasShareChannel(integrations) && !integrations.email) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={sessionExpired}
                    >
                        <Share2 className="size-4" />
                        {t('Share')}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {integrations.email && (
                        <DropdownMenuItem
                            onSelect={() => setOpen({ kind: 'email' })}
                        >
                            {t('Send to email')}
                        </DropdownMenuItem>
                    )}
                    {ShareChannels.filter(
                        (channel) => integrations[channel],
                    ).map((channel) => (
                        <DropdownMenuItem
                            key={channel}
                            onSelect={() => setOpen({ kind: 'recap', channel })}
                        >
                            {shareResultsLabel(channel, t)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <RecapShareDialog
                channel={open?.kind === 'recap' ? open.channel : null}
                onClose={() => setOpen(null)}
            />
            <EmailResultsDialog
                open={open?.kind === 'email'}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setOpen(null);
                    }
                }}
            />
        </>
    );
}
