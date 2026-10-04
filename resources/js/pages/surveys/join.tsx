import { Head } from '@inertiajs/react';
import TeamSurveyJoinsController from '@/actions/App/Http/Controllers/TeamSurveyJoinsController';
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

export default function JoinSurvey(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a survey')} />
                <GuestJoinPage
                    kind="survey"
                    invalidTitle={t('Join a survey')}
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
                kind="survey"
                invalidTitle={t('Join a survey')}
                session={props.session}
                storeUrl={TeamSurveyJoinsController.store.url(props.guestToken)}
                suggestedName={props.suggestedName}
                takenColors={props.takenColors}
                suggestedPresence={props.suggestedPresence}
            />
        </>
    );
}
