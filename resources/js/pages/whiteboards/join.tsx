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
          suggestedName: string;
          takenColors?: number[];
          suggestedPresence?: number | null;
      };

export default function JoinWhiteboard(props: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head
                title={
                    props.isInvalid
                        ? t('Join a whiteboard')
                        : props.session.title
                }
            />
            <GuestJoinPage
                kind="whiteboard"
                invalidTitle={t('Join a whiteboard')}
                session={props.isInvalid ? null : props.session}
                storeUrl={
                    props.isInvalid
                        ? null
                        : WhiteboardJoinsController.store.url(props.guestToken)
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
