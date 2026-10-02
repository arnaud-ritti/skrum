import PokerJoinsController from '@/actions/App/Http/Controllers/PokerJoinsController';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import type { JoinSession } from '@/types';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          session: JoinSession;
          suggestedName: string | null;
      };

export default function JoinPokerGame(props: Props) {
    const { t } = useTrans();

    return (
        <GuestJoinPage
            kind="poker"
            invalidTitle={t('Join a planning poker game')}
            session={props.isInvalid ? null : props.session}
            storeUrl={
                props.isInvalid
                    ? null
                    : PokerJoinsController.store.url(props.guestToken)
            }
            suggestedName={props.isInvalid ? null : props.suggestedName}
            extraFields={['spectator']}
        >
            <Switch
                id="spectator"
                name="spectator"
                value="1"
                label={t('Join as spectator')}
            />
        </GuestJoinPage>
    );
}
