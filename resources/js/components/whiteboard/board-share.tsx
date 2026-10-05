import { Share, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import WhiteboardGuestTokensController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardGuestTokensController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { ShareDialog } from '@/components/skrum/share-dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import {
    useUpdateWhiteboardSettings,
    useWhiteboardRequest,
} from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import { joinPageHost } from '@/lib/sessions/join-code';

export const GuestAccessSwitchId = 'whiteboard-guest-access';

/**
 * "Share" and its dialog: the only place of the guest link. A member copies
 * it; the facilitator also opens or closes guest access and replaces the link.
 * Closing it while a guest is on the board ends that guest's access, so it
 * asks first, as the game room does.
 */
export function BoardShare({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [confirmingGuestsOff, setConfirmingGuestsOff] = useState(false);
    const { board, me } = state.snapshot;

    const copy = async (what: 'url' | 'code'): Promise<boolean> => {
        const text = what === 'code' ? board.joinCode : board.guestUrl;

        if (!text) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);

            return true;
        } catch {
            toast.error(t('Something went wrong. Please try again.'));

            return false;
        }
    };

    const updateSettings = useUpdateWhiteboardSettings(state);
    const setGuestAccess = (allowed: boolean): Promise<boolean> =>
        updateSettings({ guest_access_enabled: allowed });

    const changeGuestAccess = (allowed: boolean): void => {
        if (!allowed && state.online.some((member) => member.isGuest)) {
            setConfirmingGuestsOff(true);

            return;
        }

        void setGuestAccess(allowed);
    };

    const turnGuestsOff = async (): Promise<void> => {
        if (!(await setGuestAccess(false))) {
            throw new Error('Guest access was not turned off.');
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
                variant={isMobile ? 'ghost' : 'default'}
                aria-label={t('Share')}
                onClick={() => setOpen(true)}
                className="shrink-0 max-lg:size-9 max-lg:px-0 max-md:size-11"
            >
                {isMobile ? (
                    <Share aria-hidden className="size-6" />
                ) : (
                    <Share2 aria-hidden />
                )}
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
                    code: board.joinCode ?? undefined,
                    joinUrl: joinPageHost(),
                }}
                canManage={me.isFacilitator}
                guestSwitchId={GuestAccessSwitchId}
                onCopy={copy}
                onChange={({ allowGuests }) => {
                    if (allowGuests !== undefined) {
                        changeGuestAccess(allowGuests);
                    }
                }}
                onRegenerate={replaceLink}
            />
            <ConfirmDialog
                open={confirmingGuestsOff}
                onOpenChange={setConfirmingGuestsOff}
                tone="destructive"
                title={t('Turn off guest access?')}
                description={t('Guests on this board lose access.')}
                confirmLabel={t('Turn off guest access')}
                onConfirm={turnGuestsOff}
            />
        </>
    );
}
