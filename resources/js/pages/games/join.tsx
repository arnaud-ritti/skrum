import GameJoinsController from '@/actions/App/Http/Controllers/GameJoinsController';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { useTrans } from '@/hooks/use-trans';
import type { GameJoinSession } from '@/types';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          session: GameJoinSession;
          suggestedName: string;
      };

export default function JoinGameRoom(props: Props) {
    const { t } = useTrans();

    return (
        <GuestJoinPage
            kind="game"
            invalidTitle={t('Join a game')}
            session={props.isInvalid ? null : props.session}
            storeUrl={
                props.isInvalid
                    ? null
                    : GameJoinsController.store.url(props.guestToken)
            }
            suggestedName={props.isInvalid ? null : props.suggestedName}
        />
    );
}
