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

    return (
        <>
            <Head
                title={
                    props.isInvalid ? t('Join a survey') : props.session.title
                }
            />
            <GuestJoinPage
                kind="survey"
                invalidTitle={t('Join a survey')}
                session={props.isInvalid ? null : props.session}
                storeUrl={
                    props.isInvalid
                        ? null
                        : TeamSurveyJoinsController.store.url(props.guestToken)
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
