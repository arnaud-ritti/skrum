import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import { authLinkClass } from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function ReminderUnsubscribe({
    unsubscribed,
    confirmUrl,
}: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);

    setLayoutProps({
        title: t('Reminder e-mails'),
        description: unsubscribed
            ? t('You no longer receive action item reminders by e-mail.')
            : t('Stop the action item reminders sent by e-mail?'),
    });

    return (
        <>
            <Head title={t('Reminder e-mails')} />

            <div className="flex flex-col gap-4 text-center">
                {!unsubscribed && (
                    <Button
                        type="button"
                        className="w-full"
                        disabled={processing}
                        data-test="unsubscribe-button"
                        onClick={() =>
                            router.post(
                                confirmUrl,
                                {},
                                {
                                    onStart: () => setProcessing(true),
                                    onFinish: () => setProcessing(false),
                                },
                            )
                        }
                    >
                        {processing && <Spinner />}
                        {t('Unsubscribe')}
                    </Button>
                )}
                <Link href={login()} className={authLinkClass}>
                    {t('Log in')}
                </Link>
            </div>
        </>
    );
}
