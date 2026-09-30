import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useBoard } from './board-context';

export function BoardPostLink() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro, integrations, linkDeliveries } = ctx.board;

    if (retro.phase === 'completed') {
        return null;
    }

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                RetroSharesController.store(retro.id),
                {
                    channel,
                    kind: 'link',
                    include_guest_link: includeGuestLink,
                },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        await ctx.refetch();

        return true;
    };

    return (
        <PostLinkSection
            availability={integrations}
            guestLinkAvailable={retro.guestAccessEnabled}
            guestLinkLabel={t(
                'Include the guest link (anyone in the channel can join)',
            )}
            deliveries={linkDeliveries}
            onPost={post}
        />
    );
}
