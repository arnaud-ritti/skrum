import { useState } from 'react';
import { toast } from 'sonner';
import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import RetroGuestTokensController from '@/actions/App/Http/Controllers/Retros/RetroGuestTokensController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { ShareDialog } from '@/components/skrum/share-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { ShareChannels } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import { joinPageHost } from '@/lib/sessions/join-code';
import type { Snapshot } from '@/lib/retro/types';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useBoard } from './board-context';

type ShareBoard = Pick<Snapshot, 'retro' | 'viewer' | 'integrations'>;

/** The channels the viewer may post the link to; none once the retro is completed. */
function linkChannels(board: ShareBoard): ShareChannel[] {
    if (board.retro.phase === 'completed') {
        return [];
    }

    return ShareChannels.filter((channel) => board.integrations[channel]);
}

/**
 * The facilitator always has the dialog: the guest link lives there only.
 * Anyone else has it when they may post the link to a channel.
 */
export function showsBoardShare(board: ShareBoard): boolean {
    return board.viewer.isFacilitator || linkChannels(board).length > 0;
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function BoardShare({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [confirmingGuestsOff, setConfirmingGuestsOff] = useState(false);
    const { board } = ctx;
    const { retro } = board;
    const channels = linkChannels(board);
    const deliveries = retro.phase === 'completed' ? [] : board.linkDeliveries;
    const canPost = channels.length > 0 || deliveries.length > 0;

    const send = async (request: Promise<unknown>): Promise<boolean> => {
        const result = await ctx.run(request);

        if (result === undefined) {
            return false;
        }

        await ctx.refetch();

        return true;
    };

    const copy = async (what: 'url' | 'code'): Promise<boolean> => {
        const text = what === 'code' ? retro.joinCode : retro.guestUrl;

        if (!text) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            toast(what === 'code' ? t('Code copied') : t('Link copied'));

            return true;
        } catch {
            toast.error(t('Something went wrong. Please try again.'));

            return false;
        }
    };

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const posted = await send(
            retroRequest<IntegrationDelivery>(
                RetroSharesController.store(retro.id),
                {
                    channel,
                    kind: 'link',
                    include_guest_link: includeGuestLink,
                },
            ),
        );

        if (posted) {
            toast(t('The message is on its way.'));
        }

        return posted;
    };

    const setGuestAccess = (allowGuests: boolean): Promise<boolean> =>
        send(
            retroRequest(RetroSettingsController.update(retro.id), {
                guest_access_enabled: allowGuests,
            }),
        );

    const turnGuestsOff = async () => {
        if (!(await setGuestAccess(false))) {
            throw new Error('Guest access was not turned off.');
        }
    };

    return (
        <>
            <ShareDialog
                open={open && !ctx.sessionExpired}
                onOpenChange={onOpenChange}
                session={{
                    id: retro.id,
                    kind: 'retro',
                    title: retro.title,
                    teamName: retro.teamName ?? undefined,
                    presentCount: ctx.online.length,
                }}
                invite={{
                    url: retro.guestUrl,
                    allowGuests: retro.guestAccessEnabled,
                    code: retro.joinCode ?? undefined,
                    joinUrl: joinPageHost(),
                }}
                canManage={board.viewer.isFacilitator}
                guestSwitchId="guest-access"
                isMobile={isMobile}
                onCopy={copy}
                onChange={(patch) => {
                    if (patch.allowGuests === undefined) {
                        return;
                    }

                    if (
                        !patch.allowGuests &&
                        ctx.online.some((member) => member.isGuest)
                    ) {
                        setConfirmingGuestsOff(true);

                        return;
                    }

                    void setGuestAccess(patch.allowGuests);
                }}
                onRegenerate={async () => {
                    await send(
                        retroRequest<{
                            guestUrl: string;
                            joinCode: string;
                        }>(RetroGuestTokensController.store(retro.id)),
                    );
                }}
                channels={channels}
                onShareToChannel={canPost ? post : undefined}
                channelsExtra={
                    deliveries.length > 0 ? (
                        <DeliveryLines deliveries={deliveries} />
                    ) : undefined
                }
            />
            <ConfirmDialog
                open={confirmingGuestsOff && !ctx.sessionExpired}
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
