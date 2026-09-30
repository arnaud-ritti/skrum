import PokerSharesController from '@/actions/App/Http/Controllers/Integrations/PokerSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameShareDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game, share, deliveries } = ctx.snapshot;

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                PokerSharesController.store(game.id),
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
                <DialogTitle>{t('Share the game')}</DialogTitle>
                <PostLinkSection
                    availability={share}
                    guestLinkAvailable={game.guestAccessEnabled}
                    guestLinkLabel={t(
                        'Include the guest link (anyone in the channel can join)',
                    )}
                    deliveries={deliveries}
                    onPost={post}
                />
            </DialogContent>
        </Dialog>
    );
}
