import { Head } from '@inertiajs/react';
import RetroJoinsController from '@/actions/App/Http/Controllers/RetroJoinsController';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { useTrans } from '@/hooks/use-trans';
import type { RetroJoinSession } from '@/types';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          session: RetroJoinSession;
          suggestedName: string;
          takenColors?: number[];
          suggestedPresence?: number | null;
      };

export default function JoinRetro(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a retrospective')} />
                <GuestJoinPage
                    kind="retro"
                    invalidTitle={t('Join a retrospective')}
                    session={null}
                    storeUrl={null}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.session.title} />
            <GuestJoinPage
                kind="retro"
                invalidTitle={t('Join a retrospective')}
                session={props.session}
                storeUrl={RetroJoinsController.store.url(props.guestToken)}
                suggestedName={props.suggestedName}
                takenColors={props.takenColors}
                suggestedPresence={props.suggestedPresence}
            />
        </>
    );
}
