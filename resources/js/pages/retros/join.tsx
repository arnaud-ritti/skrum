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

    return (
        <>
            <Head
                title={
                    props.isInvalid
                        ? t('Join a retrospective')
                        : props.session.title
                }
            />
            <GuestJoinPage
                kind="retro"
                invalidTitle={t('Join a retrospective')}
                session={props.isInvalid ? null : props.session}
                storeUrl={
                    props.isInvalid
                        ? null
                        : RetroJoinsController.store.url(props.guestToken)
                }
                suggestedName={
                    props.isInvalid ? undefined : props.suggestedName
                }
                takenColors={props.isInvalid ? undefined : props.takenColors}
                suggestedPresence={
                    props.isInvalid ? undefined : props.suggestedPresence
                }
            />
        </>
    );
}
