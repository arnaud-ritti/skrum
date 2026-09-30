import GameSharesController from '@/actions/App/Http/Controllers/Games/GameSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RoomInviteDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { room, share, deliveries } = ctx.snapshot;
    const isLinkRoom = room.access === 'link';

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

        await ctx.refetch();

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Invite to the room')}</DialogTitle>
                <PostLinkSection
                    availability={share}
                    guestLinkAvailable={isLinkRoom}
                    guestLinkLabel={t(
                        'Include the guest link (anyone who can see the message can join)',
                    )}
                    deliveries={deliveries}
                    onPost={post}
                    hint={
                        isLinkRoom
                            ? t(
                                  'Posted guest links stop working if you regenerate the link.',
                              )
                            : t('Only members of :team can join.', {
                                  team: room.teamName ?? '',
                              })
                    }
                />
            </DialogContent>
        </Dialog>
    );
}
