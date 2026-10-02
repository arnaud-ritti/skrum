import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import WhiteboardGuestTokensController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardGuestTokensController';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import { ShareDialog } from '@/components/skrum/share-dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';

export const GuestAccessSwitchId = 'whiteboard-guest-access';

/**
 * "Share" and its dialog: the only place of the guest link. A member copies
 * it; the facilitator also opens or closes guest access and replaces the link.
 */
export function BoardShare({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const { board, me } = state.snapshot;

    const copy = async (): Promise<boolean> => {
        if (!board.guestUrl) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(board.guestUrl);

            return true;
        } catch {
            toast.error(t('Something went wrong. Please try again.'));

            return false;
        }
    };

    const setGuestAccess = async (allowed: boolean): Promise<void> => {
        const done = await request(
            retroRequest(WhiteboardSettingsController.update(board.id), {
                guest_access_enabled: allowed,
            }),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    const replaceLink = async (): Promise<void> => {
        const done = await request(
            retroRequest(WhiteboardGuestTokensController.store(board.id)),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    return (
        <>
            <Button
                type="button"
                aria-label={t('Share')}
                onClick={() => setOpen(true)}
                className="shrink-0 max-lg:size-9 max-lg:px-0"
            >
                <Share2 aria-hidden />
                <span className="truncate max-lg:sr-only">{t('Share')}</span>
            </Button>
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                isMobile={isMobile}
                session={{
                    id: board.id,
                    kind: 'whiteboard',
                    title: board.title,
                    presentCount: state.online.length,
                }}
                invite={{
                    url: board.guestUrl,
                    allowGuests: board.guestAccessEnabled,
                }}
                canManage={me.isFacilitator}
                guestSwitchId={GuestAccessSwitchId}
                onCopy={copy}
                onChange={({ allowGuests }) => {
                    if (allowGuests !== undefined) {
                        void setGuestAccess(allowGuests);
                    }
                }}
                onRegenerate={replaceLink}
            />
        </>
    );
}
