import { Head } from '@inertiajs/react';
import WhiteboardJoinsController from '@/actions/App/Http/Controllers/WhiteboardJoinsController';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { useTrans } from '@/hooks/use-trans';
import type { JoinSession } from '@/types';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          session: JoinSession;
          boardTitle: string;
          suggestedName: string | null;
      };

export default function JoinWhiteboard(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a whiteboard')} />
                <GuestJoinPage
                    kind="whiteboard"
                    invalidTitle={t('Join a whiteboard')}
                    session={null}
                    storeUrl={null}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.boardTitle} />
            <GuestJoinPage
                kind="whiteboard"
                invalidTitle={t('Join a whiteboard')}
                session={props.session}
                storeUrl={WhiteboardJoinsController.store.url(props.guestToken)}
                suggestedName={props.suggestedName}
            />
        </>
    );
}
