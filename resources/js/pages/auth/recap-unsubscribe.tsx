import { UnsubscribePage } from '@/components/auth/unsubscribe-page';
import { useTrans } from '@/hooks/use-trans';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function RecapUnsubscribe(props: Props) {
    const { t } = useTrans();

    return (
        <UnsubscribePage
            title={t('Recap emails')}
            doneText={t(
                'You no longer receive the results of retrospectives by email.',
            )}
            askText={t('Stop the results of retrospectives sent by email?')}
            {...props}
        />
    );
}
