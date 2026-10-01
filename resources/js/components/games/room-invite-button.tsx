import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { hasShareChannel } from '@/lib/integrations';
import { useRoom } from './room-context';
import { RoomInviteDialog } from './room-invite-dialog';

export function RoomInviteButton() {
    const { snapshot, sessionExpired } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const canInvite = hasShareChannel(snapshot.share);

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
