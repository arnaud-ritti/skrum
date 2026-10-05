import { UnsubscribePage } from '@/components/auth/unsubscribe-page';
import { useTrans } from '@/hooks/use-trans';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function ReminderUnsubscribe(props: Props) {
    const { t } = useTrans();

    return (
        <UnsubscribePage
            title={t('Reminder emails')}
            doneText={t(
                'You no longer receive action item reminders by email.',
            )}
            askText={t('Stop the action item reminders sent by email?')}
            {...props}
        />
    );
}
