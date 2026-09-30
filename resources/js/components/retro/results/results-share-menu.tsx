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

    if (!integrations.slack && !integrations.telegram && !integrations.email) {
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
                    {integrations.slack && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setOpen({ kind: 'recap', channel: 'slack' })
                            }
                        >
                            {t('Share to Slack')}
                        </DropdownMenuItem>
                    )}
                    {integrations.telegram && (
                        <DropdownMenuItem
                            onSelect={() =>
                                setOpen({ kind: 'recap', channel: 'telegram' })
                            }
                        >
                            {t('Share to Telegram')}
                        </DropdownMenuItem>
                    )}
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
