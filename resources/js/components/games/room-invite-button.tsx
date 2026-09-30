import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { useRoom } from './room-context';
import { RoomInviteDialog } from './room-invite-dialog';

export function RoomInviteButton() {
    const { snapshot, sessionExpired } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const canInvite = snapshot.share.slack || snapshot.share.telegram;

    if (!canInvite) {
        return null;
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                disabled={sessionExpired}
                onClick={() => setOpen(true)}
            >
                <Send className="size-4" />
                {t('Invite')}
            </Button>
            <RoomInviteDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
