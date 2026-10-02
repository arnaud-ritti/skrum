import { toast } from 'sonner';
import GameGuestTokensController from '@/actions/App/Http/Controllers/Games/GameGuestTokensController';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import GameSharesController from '@/actions/App/Http/Controllers/Games/GameSharesController';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import { ShareDialog } from '@/components/skrum/share-dialog';
import type { ShareSettingsPatch } from '@/components/skrum/share-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { ShareChannels } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Everything about getting people in: the guest link, its QR code, and a post to the team's chat. */
export function RoomShareDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const { room, share, deliveries } = ctx.snapshot;
    const isLinkRoom = room.access === 'link';
    const channels = ShareChannels.filter((channel) => share[channel]);

    const copy = async (): Promise<boolean> => {
        if (room.guestUrl === null) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(room.guestUrl);
            toast(t('Link copied'));

            return true;
        } catch {
            toast.error(t('Something went wrong. Please try again.'));

            return false;
        }
    };

    const change = async ({ allowGuests }: ShareSettingsPatch) => {
        if (allowGuests === undefined) {
            return;
        }

        const result = await ctx.run(
            retroRequest(GameRoomsController.update(room.id), {
                access: allowGuests ? 'link' : 'team',
            }),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    const regenerate = async () => {
        const result = await ctx.run(
            retroRequest<{ guestUrl: string | null }>(
                GameGuestTokensController.store(room.id),
            ),
        );

        if (!result) {
            throw new Error('The guest link was not replaced.');
        }

        toast(t('A new guest link was created. The old one no longer works.'));
        await ctx.refetch();
    };

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                GameSharesController.store(room.id),
                { channel, include_guest_link: includeGuestLink },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        toast(t('The message is on its way.'));
        await ctx.refetch();

        return true;
    };

    const hasPosts = channels.length > 0 || deliveries.length > 0;

    return (
        <ShareDialog
            open={open}
            onOpenChange={onOpenChange}
            isMobile={isMobile}
            session={{
                id: room.id,
                kind: 'game',
                title: room.name ?? '',
                teamName: room.teamName ?? undefined,
                presentCount: ctx.online.length,
            }}
            invite={{ url: room.guestUrl, allowGuests: isLinkRoom }}
            canManage={room.canManage}
            guestSwitchId="room-guests"
            onCopy={copy}
            onChange={(patch) => void change(patch)}
            onRegenerate={regenerate}
            channels={channels}
            onShareToChannel={post}
            channelsExtra={
                hasPosts ? (
                    <>
                        <p className="text-xs text-muted-foreground">
                            {isLinkRoom
                                ? t(
                                      'Posted guest links stop working if you regenerate the link.',
                                  )
                                : t('Only members of :team can join.', {
                                      team: room.teamName ?? '',
                                  })}
                        </p>
                        <DeliveryLines deliveries={deliveries} />
                    </>
                ) : undefined
            }
        />
    );
}
